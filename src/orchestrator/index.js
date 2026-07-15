/**
 * 稽影 — 编排引擎（增强版：并行执行 + 完全断点恢复）
 *
 * v0.2 增强特性：
 * - 并行 Creator 执行（独立子任务同时调用）
 * - 完全断点恢复（含 Researcher/Creator/Reviewer 全部状态的持久化和恢复）
 * - 更好的进度追踪
 * - 沙箱 Executor 集成预备
 */

import { runPlanner } from '../agents/planner';
import { runResearcher } from '../agents/researcher';
import { runCreator } from '../agents/creator';
import { runReviewer } from '../agents/reviewer';
import { KnowledgeBase } from '../knowledge/manager';
import { useAgentStore } from '../store/agentStore';
import { useUserStore } from '../store/userStore';
import { initGuardian } from '../guardian';
import { recordSnapshot } from '../quality/evolution';

let guardianUnsub = null;

/**
 * 启动编排流水线
 *
 * @param {object} deps
 * @param {string} deps.apiKey
 * @param {object} deps.intent
 * @param {object} deps.trace
 * @param {object} deps.values
 * @param {object} deps.options
 * @param {boolean} [deps.options.parallel=true] - 是否并行执行独立 Creator
 * @param {boolean} [deps.options.withResearch=true] - 是否启用 Researcher
 * @param {boolean} [deps.options.withReview=true] - 是否启用 Reviewer
 * @param {Array} [deps.options.skipSteps] - 跳过的步骤 ID
 * @param {object} [deps.options.userEdits] - 用户手动编辑内容
 * @returns {Promise<object>}
 */
export async function orchestrate({ apiKey, intent, trace, values, options = {}, savedResult = null }) {
  const store = useAgentStore.getState();
  const userStore = useUserStore.getState();
  const modelConfig = {
    modelProvider: userStore.modelProvider || 'deepseek',
    customBaseURL: userStore.customBaseURL,
    modelName: userStore.modelName,
  };

  if (savedResult) {
    store.setStatus('running');
  } else {
    store.reset();
    store.setStatus('running');
  }

  if (!guardianUnsub) {
    guardianUnsub = initGuardian(useAgentStore);
  }

  const parallel = options.parallel !== false;

  try {
    let plan;
    let researchResults = [];
    let creatorResults = [];
    let reviewResult = null;
    let stepCount = 0;

    // ============== Step 1: Planner ==============
    if (savedResult?.plan) {
      plan = savedResult.plan;
      researchResults = savedResult.researchResults || [];
      creatorResults = savedResult.creatorResults || [];
      reviewResult = savedResult.review || null;
    } else {
      store.setCurrentStep(1);
      plan = await runPlanner({ apiKey, ...modelConfig, intent, trace, values });
      store.appendOutput({
        agent: 'planner',
        output: plan.rawText,
        filtered: plan.constitution.status !== 'pass',
        constitution: plan.constitution.status,
      });
      // 立即持久化
      store.setResult({ plan, researchResults: [], creatorResults: [], review: null, totalSteps: 0, status: 'running' });
    }

    // 简单模式：跳过 Planner + Researcher，直接单次生成 + 审查
    if (options.simpleMode) {
      return handleSimpleMode({ apiKey, modelConfig, intent, trace, values, plan, options, store });
    }

    const withResearch = options.withResearch !== false;
    const withReview = options.withReview !== false;
    const skipSteps = new Set(options.skipSteps || []);
    const userEdits = options.userEdits || {};

    // 计算总步骤数
    stepCount = 1; // planner
    if (withResearch) stepCount += plan.subtasks.length;
    stepCount += plan.subtasks.length; // creator
    if (withReview) stepCount += 1;
    store.setTotalSteps(stepCount);

    let currentStep = savedResult ? (savedResult.currentStep ?? 1) : 1;

    // ============== Step 2: Researcher (可选，可并行) ==============
    if (withResearch) {
      const researchTasks = [];
      let allDone = true;

      for (const subtask of plan.subtasks) {
        const alreadyDone = savedResult && researchResults.find((r) => r.subtaskId === subtask.id);
        if (alreadyDone || skipSteps.has(subtask.id)) {
          if (alreadyDone) currentStep++;
          continue;
        }
        allDone = false;

        researchTasks.push(async () => {
          const kbContext = await KnowledgeBase.getContext(
            `${subtask.title} ${subtask.goal} ${intent.goal}`,
          );

          const research = await runResearcher({
            apiKey, ...modelConfig, intent, trace, values, subtask,
            plannerReasoning: plan.reasoning,
            knowledgeContext: kbContext,
          });

          researchResults.push({ subtaskId: subtask.id, ...research });

          store.appendOutput({
            agent: 'researcher',
            output: research.rawText,
            filtered: research.constitution.status !== 'pass',
            constitution: research.constitution.status,
            subtaskId: subtask.id,
          });

          // 每完成一个 Researcher 立即持久化
          store.setResult({
            plan, researchResults: [...researchResults], creatorResults, review: reviewResult,
            totalSteps: stepCount, status: 'running', currentStep: ++currentStep,
          });
        });
      }

      if (researchTasks.length > 0) {
        // 串行执行 Researcher（依赖 API 响应速度，过多并行可能触发限流）
        for (const task of researchTasks) {
          await task();
        }
      }
    }

    // ============== Step 3: Creator (支持并行) ==============
    const creatorTasks = [];
    for (const subtask of plan.subtasks) {
      const alreadyDone = savedResult && creatorResults.find((r) => r.subtask?.id === subtask.id);
      if (alreadyDone) {
        currentStep++;
        continue;
      }
      if (skipSteps.has(subtask.id)) {
        currentStep++;
        creatorResults.push({
          subtask, content: '', assumptions: '',
          constitution: { status: 'pass', violations: [] },
          rawText: '', skipped: true,
        });
        continue;
      }
      if (userEdits[subtask.id]) {
        currentStep++;
        creatorResults.push({
          subtask, content: userEdits[subtask.id], assumptions: '',
          constitution: { status: 'pass', violations: [] },
          rawText: '', userEdited: true,
        });
        store.appendOutput({
          agent: 'creator', output: userEdits[subtask.id],
          filtered: false, constitution: 'pass', subtaskId: subtask.id,
        });
        continue;
      }

      creatorTasks.push(async () => {
        const subResearch = researchResults.find((r) => r.subtaskId === subtask.id);
        const kbContext = await KnowledgeBase.getContext(`${subtask.title} ${subtask.goal}`);
        const combinedContext = [subResearch?.content, kbContext].filter(Boolean).join('\n\n');

        const creatorOutput = await runCreator({
          apiKey, ...modelConfig, intent, trace, values, subtask,
          plannerReasoning: plan.reasoning,
          knowledgeContext: combinedContext,
        });

        creatorResults.push({ subtask, research: subResearch, ...creatorOutput });

        store.appendOutput({
          agent: 'creator',
          output: creatorOutput.rawText,
          filtered: creatorOutput.constitution.status !== 'pass',
          constitution: creatorOutput.constitution.status,
          subtaskId: subtask.id,
        });

        // 每完成一个 Creator 立即持久化
        store.setResult({
          plan, researchResults: [...researchResults], creatorResults: [...creatorResults],
          review: reviewResult, totalSteps: stepCount, status: 'running', currentStep: ++currentStep,
        });
      });
    }

    if (creatorTasks.length > 0) {
      if (parallel && creatorTasks.length > 1) {
        // 并行互不依赖的 Creator
        await Promise.all(creatorTasks.map((t) => t()));
      } else {
        for (const task of creatorTasks) {
          await task();
        }
      }
    }

    // ============== Step 4: Reviewer ==============
    if (withReview && !reviewResult) {
      currentStep++;
      store.setCurrentStep(currentStep);

      const combinedContent = creatorResults
        .filter((r) => !r.skipped && !r.userEdited)
        .map((r) => r.content)
        .join('\n\n---\n\n');

      if (combinedContent.trim()) {
        const strictMode = useUserStore.getState().uncomfortableMode;
        reviewResult = await runReviewer({
          apiKey, ...modelConfig, content: combinedContent, intent, strictMode,
        });

        store.appendOutput({
          agent: 'reviewer',
          output: JSON.stringify(reviewResult),
          filtered: reviewResult.constitution?.status !== 'pass',
          constitution: reviewResult.constitution?.status || 'pass',
        });
      }
    }

    const finalResult = { plan, researchResults, creatorResults, review: reviewResult, totalSteps: stepCount, status: 'completed' };
    store.setResult(finalResult);
    store.setStatus('completed');
    store.setCurrentStep(stepCount);
    store.addTaskHistory({ goal: intent.goal, status: 'completed', subtaskCount: plan.subtasks.length });

    // C9 演化记录：每次任务完成自动快照
    try {
      recordSnapshot({
        constitutionViolations: [
          plan?.constitution?.status === 'block' ? 1 : 0,
          ...(creatorResults || []).map((r) => r.constitution?.status === 'block' ? 1 : 0),
        ].reduce((a, b) => a + b, 0),
        userEdits: creatorResults?.filter((r) => r.userEdited).length || 0,
        avgConfidence: 3,
        avgReviewScore: reviewResult?.overall || 3,
        taskCount: 1,
      });
    } catch { /* 静默：演化记录失败不影响主流程 */ }

    return finalResult;
  } catch (e) {
    store.setError(e.message);
    // 异常时保存当前进度以便恢复
    try {
      store.setResult({
        plan: typeof plan !== 'undefined' ? plan : null,
        researchResults: typeof researchResults !== 'undefined' ? researchResults : [],
        creatorResults: typeof creatorResults !== 'undefined' ? creatorResults : [],
        review: typeof reviewResult !== 'undefined' ? reviewResult : null,
        totalSteps: typeof stepCount !== 'undefined' ? stepCount : 0,
        status: 'error',
        error: e.message,
      });
    } catch (innerErr) {
      console.warn('[Orchestrator] 保存进度失败:', innerErr.message);
    }
    throw e;
  }
}

/**
 * 简单模式处理
 */
async function handleSimpleMode({ apiKey, modelConfig, intent, trace, values, plan, options, store }) {
  store.setTotalSteps(2);
  store.setCurrentStep(1);

  const simplePlan = {
    subtasks: [{ id: 1, title: '直接生成', goal: intent.goal, dependsOn: [] }],
    reasoning: '快速模式——跳过拆解和调研',
  };

  store.appendOutput({
    agent: 'planner', output: '[快速模式] 跳过 Planner 拆解',
    filtered: false, constitution: 'pass',
  });

  const creatorOutput = await runCreator({
    apiKey, ...modelConfig, intent, trace, values,
    subtask: simplePlan.subtasks[0],
    plannerReasoning: simplePlan.reasoning,
    knowledgeContext: '',
  });

  store.setCurrentStep(2);
  store.appendOutput({
    agent: 'creator', output: creatorOutput.rawText,
    filtered: creatorOutput.constitution.status !== 'pass',
    constitution: creatorOutput.constitution.status,
    subtaskId: 1,
  });

  const creatorResults = [{ subtask: simplePlan.subtasks[0], ...creatorOutput }];

  const strictMode = useUserStore.getState().uncomfortableMode;
  const combinedContent = creatorResults.map((r) => r.content).join('\n');
  let reviewResult = null;
  if (combinedContent.trim()) {
    reviewResult = await runReviewer({
      apiKey, ...modelConfig, content: combinedContent, intent, strictMode,
    });
    store.appendOutput({
      agent: 'reviewer',
      output: JSON.stringify(reviewResult),
      filtered: reviewResult.constitution?.status !== 'pass',
      constitution: reviewResult.constitution?.status || 'pass',
    });
  }

  const result = {
    plan: simplePlan, researchResults: [], creatorResults, review: reviewResult,
    totalSteps: 2, status: 'completed',
  };
  store.setResult(result);
  store.setStatus('completed');
  store.setCurrentStep(2);
  store.addTaskHistory({ goal: intent.goal, status: 'completed', subtaskCount: 1 });

  return result;
}

/**
 * Reflexion 循环：根据 Reviewer 反馈重新运行 Creator → Reviewer
 */
export async function improveIteration({ apiKey, intent, trace, values, review }) {
  const store = useAgentStore.getState();
  const userStore = useUserStore.getState();
  const modelConfig = {
    modelProvider: userStore.modelProvider || 'deepseek',
    customBaseURL: userStore.customBaseURL,
    modelName: userStore.modelName,
  };

  const saved = store.result;
  if (!saved?.creatorResults?.length) throw new Error('没有可改进的 Creator 结果');

  const feedbackText = [
    `综合评分: ${review.overall}/5`,
    '问题和建议:',
    ...(review.issues || []).map((i) => `- ${i}`),
  ].join('\n');

  const creatorTasks = saved.creatorResults.map((item) => async () => {
    return await runCreator({
      apiKey, ...modelConfig, intent, trace, values,
      subtask: item.subtask,
      plannerReasoning: saved.plan?.reasoning || '',
      knowledgeContext: `[上一轮审查反馈]\n${feedbackText}`,
    });
  });

  // 并行执行改进
  const improvedOutputs = await Promise.all(creatorTasks.map((t) => t()));

  const improvedResults = saved.creatorResults.map((item, i) => ({
    subtask: item.subtask,
    research: saved.researchResults?.find((r) => r.subtaskId === item.subtask.id),
    ...improvedOutputs[i],
  }));

  const combinedContent = improvedResults.map((r) => r.content).join('\n\n---\n\n');
  const strictMode = userStore.uncomfortableMode;
  const newReview = await runReviewer({
    apiKey, ...modelConfig, content: combinedContent, intent, strictMode,
  });

  return { creatorResults: improvedResults, review: newReview };
}

export function shutdown() {
  if (guardianUnsub) { guardianUnsub(); guardianUnsub = null; }
}
