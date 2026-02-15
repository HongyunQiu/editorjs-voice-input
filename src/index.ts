import './index.css';

import { make } from '@editorjs/dom';
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

export default class VoiceInputTool implements BlockTool {
  private api: API;
  private readOnly: boolean;
  private config: VoiceInputConfig;
  private data: VoiceInputData;

  private wrapper?: HTMLElement;
  private textEl?: HTMLElement;
  private hintEl?: HTMLElement;
  private micBtn?: HTMLButtonElement;

  private recognition: SpeechRecognitionLike | null = null;
  private isRecording = false;

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

    if (this.readOnly) {
      btn.disabled = true;
    } else {
      btn.addEventListener('click', () => {
        if (this.isRecording) this.stopRecording();
        else this.startRecording();
      });
    }

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
  }

  private getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
    const w = window as any;
    return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as SpeechRecognitionCtor | null;
  }

  private startRecording() {
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
        this.setHint(`${this.api.i18n.t('语音识别错误')}: ${e?.error || 'unknown'}`);
        this.stopRecording();
      };

      this.recognition.onend = () => {
        this.isRecording = false;
        this.updateMicState();
      };
    }

    this.isRecording = true;
    this.updateMicState();
    this.setHint(this.api.i18n.t('录音中…再次点击可停止'));
    this.recognition.start();
  }

  private stopRecording() {
    if (this.recognition && this.isRecording) {
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
