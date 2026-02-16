import './index.css';

import type { API, BlockTool, SanitizerConfig, ToolConfig } from '@editorjs/editorjs';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export interface VoiceInputData {
  text: string;
  locale?: string;
}

export interface VoiceInputConfig extends ToolConfig {
  locale?: string;
  continuous?: boolean;
  interimResults?: boolean;
  placeholder?: string;
}

const ICON_MIC = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15a4 4 0 0 0 4-4V7a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Zm7-4a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.07A7 7 0 0 0 19 11Z" fill="currentColor"/></svg>`;

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classNames: string[] = [],
  attrs: Record<string, string | boolean> = {},
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (classNames.length) el.className = classNames.join(' ');
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'contentEditable') {
      el.contentEditable = String(value);
      return;
    }
    if (key === 'type') {
      el.setAttribute('type', String(value));
      return;
    }
    el.setAttribute(key, String(value));
  });
  return el;
}

export default class VoiceInputTool implements BlockTool {
  private api: API;
  private readOnly: boolean;
  private config: VoiceInputConfig;
  private data: VoiceInputData;

  private wrapper?: HTMLElement;
  private textEl?: HTMLElement;
  private hintEl?: HTMLElement;
  private micBtn?: HTMLButtonElement;
  private onMicClick?: () => void;

  private recognition: SpeechRecognitionLike | null = null;
  private isRecording = false;
  private stopReason: 'none' | 'user' | 'error' = 'none';

  static get isReadOnlySupported() {
    return true;
  }

  static get toolbox() {
    return {
      title: 'Voice Input',
      icon: ICON_MIC,
    };
  }

  static get sanitize(): SanitizerConfig {
    return { text: false as any, locale: false as any };
  }

  constructor({ data, config, api, readOnly }: { data: VoiceInputData; config?: VoiceInputConfig; api: API; readOnly: boolean }) {
    this.api = api;
    this.readOnly = readOnly;
    this.config = config || {};
    this.data = {
      text: typeof data?.text === 'string' ? data.text : '',
      locale: typeof data?.locale === 'string' ? data.locale : this.config.locale || 'zh-CN',
    };
  }

  render(): HTMLElement {
    const wrap = make('div', ['cdx-voice-input']) as HTMLElement;
    this.wrapper = wrap;

    const toolbar = make('div', ['cdx-voice-input__toolbar']) as HTMLElement;
    const btn = make('button', ['cdx-voice-input__btn'], { type: 'button' }) as HTMLButtonElement;
    btn.innerHTML = `${ICON_MIC} ${this.api.i18n.t('开始语音输入')}`;
    const hint = make('span', ['cdx-voice-input__hint']) as HTMLElement;
    hint.textContent = this.api.i18n.t('支持 Chrome/Edge 的语音识别能力');

    this.micBtn = btn;
    this.hintEl = hint;

    // 注意：Editor.js 的 readOnly.toggle() 在某些场景下不会重建 Tool 实例；
    // 为避免按钮在初始只读渲染后“永远不可用”，这里始终绑定点击事件，
    // 并提供 applyReadOnly(readOnly) 供宿主在切换时同步 UI。
    this.onMicClick = () => {
      if (this.readOnly) {
        this.setHint(this.api.i18n.t('当前为只读模式，无法开始语音输入'));
        return;
      }
      if (this.isRecording) this.stopRecording();
      else this.startRecording();
    };
    btn.addEventListener('click', this.onMicClick);
    btn.disabled = this.readOnly;

    toolbar.appendChild(btn);
    toolbar.appendChild(hint);

    const text = make('div', ['cdx-voice-input__text'], {
      contentEditable: !this.readOnly,
    }) as HTMLElement;
    text.dataset.placeholder = this.config.placeholder || this.api.i18n.t('点击麦克风开始输入，或直接手动编辑文本');
    text.innerHTML = this.data.text || '';
    this.textEl = text;

    wrap.appendChild(toolbar);
    wrap.appendChild(text);

    // 注册到全局：供宿主应用运行时只读切换（不污染 EditorJS API）
    try {
      const w = window as any;
      if (!w.__QNotesVoiceInputs) w.__QNotesVoiceInputs = [];
      if (Array.isArray(w.__QNotesVoiceInputs) && !w.__QNotesVoiceInputs.includes(this)) {
        w.__QNotesVoiceInputs.push(this);
      }
    } catch (_) {}

    return wrap;
  }

  save(): VoiceInputData {
    return {
      text: this.textEl?.innerHTML || '',
      locale: this.data.locale || this.config.locale || 'zh-CN',
    };
  }

  validate(savedData: VoiceInputData): boolean {
    return !!savedData && typeof savedData.text === 'string';
  }

  destroy() {
    this.stopRecording();
    // 从全局注册表移除，避免内存泄漏
    try {
      const w = window as any;
      const arr = w.__QNotesVoiceInputs;
      if (Array.isArray(arr)) {
        const idx = arr.indexOf(this);
        if (idx >= 0) arr.splice(idx, 1);
      }
    } catch (_) {}
  }

  /**
   * 供宿主调用：在运行时切换只读/编辑状态。
   * Editor.js 自身 readOnly.toggle() 不保证会重建 Tool 或重新调用 render()。
   */
  applyReadOnly(readOnly: boolean) {
    const next = !!readOnly;
    if (this.readOnly === next) return;
    this.readOnly = next;
    if (this.readOnly) {
      // 切到只读时，强制停止录音避免后台继续占用麦克风
      this.stopRecording();
    }
    if (this.micBtn) this.micBtn.disabled = this.readOnly;
    if (this.textEl) this.textEl.contentEditable = String(!this.readOnly);
  }

  private getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
    const w = window as any;
    return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as SpeechRecognitionCtor | null;
  }

  private startRecording() {
    // Chrome/Edge 的语音识别通常要求安全上下文：
    // - https://
    // - http://localhost / 127.0.0.1（localhost 特例）
    // 若通过局域网 IP 用 http 访问，浏览器会直接拒绝且不会弹权限对话框。
    try {
      const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
      const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
      if (typeof window !== 'undefined' && window.isSecureContext === false && !isLoopback) {
        const origin = window.location && window.location.origin ? window.location.origin : '';
        this.setHint(this.api.i18n.t(`当前页面非安全上下文，浏览器将拒绝语音权限：${origin}。请用 https 或 localhost 打开。`));
        return;
      }
    } catch (_) {}

    const Ctor = this.getSpeechRecognitionCtor();
    if (!Ctor) {
      this.setHint(this.api.i18n.t('当前浏览器不支持 SpeechRecognition，请切换 Chrome/Edge。'));
      return;
    }

    if (!this.recognition) {
      this.recognition = new Ctor();
      this.recognition.lang = this.data.locale || this.config.locale || 'zh-CN';
      this.recognition.continuous = this.config.continuous ?? true;
      this.recognition.interimResults = this.config.interimResults ?? true;

      this.recognition.onresult = (event: any) => {
        const current = this.textEl?.innerText || '';
        let finalText = '';
        let interimText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) finalText += t;
          else interimText += t;
        }

        if (this.textEl) {
          const merged = `${current}${finalText}`.trim();
          this.textEl.innerText = merged || interimText || current;
        }
      };

      this.recognition.onerror = (e: any) => {
        // 这里不要调用 stopRecording()，否则会把错误提示覆盖成“已停止语音输入”
        this.stopReason = 'error';
        const code = e?.error || 'unknown';
        let extra = '';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          extra = '（可能是未授予麦克风权限，或当前页面非安全上下文）';
        } else if (code === 'network') {
          extra = '（网络异常或语音服务不可用）';
        }
        this.setHint(`${this.api.i18n.t('语音识别错误')}: ${code}${extra}`);
        // 结束识别并复位 UI，但保留错误提示
        try {
          if (this.recognition) {
            if (typeof this.recognition.abort === 'function') this.recognition.abort();
            else this.recognition.stop();
          }
        } catch (_) {}
        this.isRecording = false;
        this.updateMicState();
      };

      this.recognition.onend = () => {
        this.isRecording = false;
        this.updateMicState();
        // 若是错误触发的 end，不覆盖错误提示
        if (this.stopReason !== 'error') {
          this.setHint(this.api.i18n.t('已停止语音输入'));
        }
        this.stopReason = 'none';
      };
    }

    this.stopReason = 'none';
    this.isRecording = true;
    this.updateMicState();
    this.setHint(this.api.i18n.t('录音中…再次点击可停止'));
    try {
      this.recognition.start();
    } catch (e: any) {
      // start() 也可能直接抛错（例如 InvalidStateError / NotAllowedError）
      this.stopReason = 'error';
      const msg = (e && (e.name || e.message)) ? String(e.name || e.message) : 'unknown';
      this.isRecording = false;
      this.updateMicState();
      this.setHint(`${this.api.i18n.t('语音识别错误')}: ${msg}`);
    }
  }

  private stopRecording() {
    if (this.recognition && this.isRecording) {
      this.stopReason = 'user';
      this.recognition.stop();
    }
    this.isRecording = false;
    this.updateMicState();
    this.setHint(this.api.i18n.t('已停止语音输入'));
  }

  private updateMicState() {
    if (!this.micBtn) return;
    if (this.isRecording) {
      this.micBtn.classList.add('is-recording');
      this.micBtn.innerHTML = `${ICON_MIC} ${this.api.i18n.t('停止语音输入')}`;
    } else {
      this.micBtn.classList.remove('is-recording');
      this.micBtn.innerHTML = `${ICON_MIC} ${this.api.i18n.t('开始语音输入')}`;
    }
  }

  private setHint(text: string) {
    if (this.hintEl) this.hintEl.textContent = text;
  }
}
