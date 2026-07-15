/**
 * 稽影 — React 错误边界
 *
 * 捕获渲染阶段的 React 错误，防止整个应用白屏。
 * 显示友好的错误提示 + 重试/回退按钮。
 */
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.hash = '/';
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="max-w-md p-8 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">⚠️</span>
              <h2 className="text-lg font-semibold text-gray-900">
                出现问题
              </h2>
            </div>
            <p className="text-sm text-gray-600 mb-2 leading-relaxed">
              稽影遇到了一个意外错误。这不会影响你的数据——所有内容已保存在本地。
            </p>
            <p className="text-xs text-gray-400 mb-5 font-mono bg-gray-50 p-2 rounded-lg overflow-auto max-h-20">
              {this.state.error?.message || '未知错误'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium
                           hover:bg-purple-700 transition-colors"
              >
                重试
              </button>
              <button
                onClick={this.handleGoHome}
                className="px-5 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg
                           hover:bg-gray-50 transition-colors"
              >
                回到首页
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-4">
              如果问题持续出现，可以尝试清除浏览器缓存或联系支持。
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
