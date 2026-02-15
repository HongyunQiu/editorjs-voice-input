class SimpleEditorTest {
  constructor() {
    this.editor = null;
    this.savedData = null;
    this.VoiceInputTool = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.checkPlugins();
  }

  checkPlugins() {
    window.addEventListener('load', () => {
      const voiceGlobal = window.VoiceInput;
      const VoiceInputTool = voiceGlobal && (voiceGlobal.default || voiceGlobal);
      this.VoiceInputTool = VoiceInputTool;

      console.log('EditorJS:', typeof window.EditorJS);
      console.log('VoiceInput (UMD):', typeof voiceGlobal);
      console.log('VoiceInput Tool:', typeof VoiceInputTool);

      if (!window.EditorJS || !window.Header || !window.Paragraph || !window.Checklist || !window.Quote || !window.Delimiter || !VoiceInputTool) {
        this.showMessage('插件加载不完整，请先构建 dist 并确认 test 页脚本引入正确。', 'error');
      } else {
        this.showMessage('插件加载成功（含 Voice Input）', 'success');
      }
    });
  }

  bindEvents() {
    document.getElementById('init-editor').addEventListener('click', () => this.initEditor());
    document.getElementById('save-content').addEventListener('click', () => this.saveContent());
    document.getElementById('load-content').addEventListener('click', () => this.loadContent());
    document.getElementById('clear-editor').addEventListener('click', () => this.clearEditor());
  }

  initEditor() {
    try {
      if (this.editor) this.editor.destroy();

      const VoiceInputTool = this.VoiceInputTool;
      if (!VoiceInputTool) {
        this.showMessage('未找到 Voice Input 工具，请确认 ../dist/voiceInput.umd.js 已加载。', 'error');
        return;
      }

      this.editor = new window.EditorJS({
        holder: 'editorjs',
        tools: {
          header: {
            class: window.Header,
            config: { levels: [1, 2, 3, 4, 5, 6], defaultLevel: 2, placeholder: '输入标题' },
          },
          paragraph: {
            class: window.Paragraph,
            inlineToolbar: true,
            config: { placeholder: '输入段落内容...' },
          },
          checklist: { class: window.Checklist, inlineToolbar: true },
          quote: { class: window.Quote, inlineToolbar: true },
          delimiter: { class: window.Delimiter },
          voiceInput: {
            class: VoiceInputTool,
            inlineToolbar: false,
            config: {
              locale: 'zh-CN',
              continuous: true,
              interimResults: true,
              placeholder: '点击麦克风开始语音输入，或直接编辑文本',
            },
          },
        },
        data: {
          time: Date.now(),
          blocks: [
            { type: 'header', data: { text: 'Editor.js + Voice Input 测试', level: 1 } },
            {
              type: 'paragraph',
              data: { text: '下方 voiceInput 块可直接点麦克风进行语音输入（浏览器会申请麦克风权限）。' },
            },
            {
              type: 'voiceInput',
              data: { text: '这是初始文本。你可以点击“开始语音输入”追加语音内容。', locale: 'zh-CN' },
            },
          ],
        },
      });

      this.showMessage('编辑器初始化成功（已注册 Voice Input 工具）', 'success');
    } catch (error) {
      this.showMessage(`编辑器初始化失败: ${error.message}`, 'error');
    }
  }

  async saveContent() {
    if (!this.editor) return this.showMessage('请先初始化编辑器', 'warning');

    try {
      const outputData = await this.editor.save();
      this.savedData = outputData;
      document.getElementById('output').innerHTML = `<h4>保存的数据 (JSON)</h4><pre>${JSON.stringify(outputData, null, 2)}</pre>`;
      this.showMessage('内容保存成功', 'success');
    } catch (error) {
      this.showMessage(`保存失败: ${error.message}`, 'error');
    }
  }

  async loadContent() {
    if (!this.savedData) return this.showMessage('没有可加载的内容', 'warning');
    if (!this.editor) return this.showMessage('请先初始化编辑器', 'warning');

    try {
      await this.editor.render(this.savedData);
      this.showMessage('内容加载成功', 'success');
    } catch (error) {
      this.showMessage(`加载失败: ${error.message}`, 'error');
    }
  }

  clearEditor() {
    if (!this.editor) return this.showMessage('请先初始化编辑器', 'warning');

    this.editor.clear();
    document.getElementById('output').innerHTML = '';
    this.savedData = null;
    this.showMessage('编辑器已清空', 'success');
  }

  showMessage(message, type = 'info') {
    const div = document.createElement('div');
    div.className = `message message-${type}`;
    div.textContent = message;
    document.body.insertBefore(div, document.body.firstChild);
    setTimeout(() => div.remove(), 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => new SimpleEditorTest());
