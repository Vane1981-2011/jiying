import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useIntentStore } from '../store/intentStore';
import { useAgentStore } from '../store/agentStore';
import { useGuardianStore } from '../store/guardianStore';
import { useUserStore } from '../store/userStore';
import { AuditCollector, checkSpeedBump } from '../audit/collector';
import { orchestrate, improveIteration } from '../orchestrator';
import { buildMarkdownExport, downloadMarkdown } from '../utils/export';
import { challenge } from '../quality/devilsAdvocate';
import { ethicsAmplificationCheck } from '../quality/ethicsCheck';
import AssemblyPipeline from '../components/AssemblyPipeline';
import AssemblyOutput from '../components/AssemblyOutput';
import AssemblyControls from '../components/AssemblyControls';

export default function AssemblyLine() {
  const navigate = useNavigate();
  const { intent, trace, values, status: intentStatus } = useIntentStore();
  const apiKey = useUserStore((s) => s.apiKey);
  const guardianAlerts = useGuardianStore((s) => s.alerts);
  const {
    agentOutputs, currentStep, totalSteps, status: execStatus, setStatus: setExecStatus,
    result, setResult, skipSteps: storedSkips, setSkipSteps: storeSkips,
    userEdits: storedEdits, setUserEdits: storeEdits,
    error: storeError, setError: setStoreError,
  } = useAgentStore();

  const [skipSteps] = useState(new Set(storedSkips));
  const [userEdits, setLocalEdits] = useState(storedEdits);
  const [editingStep, setEditingStep] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [rebuttals, setRebuttals] = useState({});
  const [error, setError] = useState(storeError);
  const [iterations, setIterations] = useState([]);
  const [improving, setImproving] = useState(false);
  const [speedBump, setSpeedBump] = useState(null);
  const [devilResult, setDevilResult] = useState(null);
  const [ethicsResult, setEthicsResult] = useState(null);
  const [exportQuality, setExportQuality] = useState(null);
  const [qualityExpanded, setQualityExpanded] = useState(false);

  const updateSkipSteps = (s) => { storeSkips(Array.from(s)); };
  const updateUserEdits = (e) => { storeEdits(e); setLocalEdits(e); };
  const updateResult = (r) => { setResult(r); };
  const updateError = (e) => { setError(e); setStoreError(e); };

  useEffect(() => {
    if (intentStatus !== 'confirmed' || !intent.goal) navigate('/');
  }, []);

  useEffect(() => {
    if (intentStatus !== 'confirmed') return;
    if (execStatus === 'completed') return;
    if (execStatus === 'running' && result) runOrchestration(true);
    else if (execStatus === 'idle' && !result) runOrchestration(false);
  }, []);

  const runOrchestration = useCallback(async (resume = false) => {
    if (!apiKey) { updateError('请先配置 DeepSeek API Key'); return; }
    updateError(null);
    try {
      const r = await orchestrate({
        apiKey, intent, trace, values,
        options: { skipSteps: Array.from(skipSteps), userEdits, simpleMode: intent.simpleMode || false },
        savedResult: resume ? result : null,
      });
      updateResult(r);
      const bump = checkSpeedBump({ totalTasks: 1 });
      if (bump) setSpeedBump(bump);
    } catch (e) { updateError(e.message); }
  }, [apiKey, intent, trace, values, skipSteps, userEdits, result]);

  const handleImprove = async () => {
    if (!apiKey || !result?.review || iterations.length >= 5) return;
    setImproving(true);
    try {
      const r = await improveIteration({ apiKey, intent, trace, values, review: result.review });
      setIterations([...iterations, r]);
    } catch (e) { setError(`改进失败: ${e.message}`); }
    finally { setImproving(false); }
  };

  const toggleSkipStep = (stepId) => {
    const next = new Set(skipSteps);
    next.has(stepId) ? next.delete(stepId) : next.add(stepId);
    updateSkipSteps(next);
    if (next.has(stepId)) { setEditingStep(stepId); setEditContent(''); }
  };

  const submitUserEdit = (stepId) => {
    updateUserEdits({ ...userEdits, [stepId]: editContent });
    AuditCollector.stepUserDid(stepId);
    setEditingStep(null);
    setExecStatus('idle'); updateResult(null);
    runOrchestration();
  };

  const cancelEdit = (stepId) => {
    const next = new Set(skipSteps); next.delete(stepId);
    updateSkipSteps(next); setEditingStep(null);
  };

  const rebutAssumption = (stepId, correction) => {
    setRebuttals((prev) => ({ ...prev, [stepId]: correction }));
    AuditCollector.assumptionRebuttal(stepId);
  };

  // --- Composed handlers for sub-components ---
  const handleRetry = () => { updateError(null); setExecStatus('idle'); updateResult(null); runOrchestration(); };

  const makeCombinedContent = () =>
    (result.creatorResults || []).filter((r) => r.content).map((r) => r.content).join('\n');

  const handleDevilAdvocate = () => {
    setDevilResult(challenge({ content: makeCombinedContent() || intent.goal, context: intent.goal, mode: 'quick' }));
  };

  const handleExport = () => {
    const exported = buildMarkdownExport({
      goal: intent.goal, background: intent.background,
      plan: result.plan, creatorResults: result.creatorResults, review: result.review,
    });
    const qr = downloadMarkdown(exported, intent.goal);
    if (qr) setExportQuality(qr);
  };

  const handleEthicsCheck = () => {
    setEthicsResult(ethicsAmplificationCheck({ content: makeCombinedContent() || intent.goal, goal: intent.goal }));
  };

  const constitutionStatus = result
    ? (result.plan?.constitution?.status === 'block' || result.creatorResults?.some((r) => r.constitution?.status === 'block')
      ? 'block' : result.creatorResults?.some((r) => r.constitution?.status === 'warn') ? 'warn' : 'pass')
    : null;

  return (
    <div className="h-full flex">
      {/* LEFT: Agent output area — 60% */}
      <div className="flex-1 overflow-y-auto px-10 py-8">
        {execStatus === 'running' && !result && (
          <AssemblyPipeline agentOutputs={agentOutputs} intent={intent} error={null} onRetry={handleRetry} />
        )}
        {error && (
          <AssemblyPipeline agentOutputs={[]} intent={intent} error={error} onRetry={handleRetry} />
        )}
        {result && (
          <AssemblyOutput
            result={result} intent={intent} iterations={iterations}
            improving={improving} onImprove={handleImprove}
            devilResult={devilResult} onDevilAdvocate={handleDevilAdvocate}
            speedBump={speedBump}
            exportQuality={exportQuality} qualityExpanded={qualityExpanded}
            onToggleQualityExpanded={() => setQualityExpanded((v) => !v)} onExport={handleExport}
            skipSteps={skipSteps} userEdits={userEdits} rebuttals={rebuttals}
            editingStep={editingStep} editContent={editContent}
            onEditContentChange={setEditContent}
            onToggleSkip={toggleSkipStep} onSubmitEdit={submitUserEdit}
            onCancelEdit={cancelEdit} onRebuttal={rebutAssumption}
          />
        )}
      </div>

      {/* RIGHT: Context panel — 40% */}
      <AssemblyControls
        intent={intent} trace={trace} values={values}
        constitutionStatus={constitutionStatus}
        ethicsResult={ethicsResult} onEthicsCheck={handleEthicsCheck}
        result={result} speedBump={speedBump} guardianAlerts={guardianAlerts}
        execStatus={execStatus} currentStep={currentStep} totalSteps={totalSteps}
      />
    </div>
  );
}
