# @editorjs/voice-input

Voice Input Tool for Editor.js. Supports browser speech recognition (Chrome/Edge).

## Install

```bash
npm i @editorjs/voice-input
```

## Usage

```js
import VoiceInput from '@editorjs/voice-input';

const editor = new EditorJS({
  tools: {
    voiceInput: {
      class: VoiceInput,
      config: {
        locale: 'zh-CN',
        continuous: true,
        interimResults: true,
        placeholder: '点击麦克风开始语音输入'
      }
    }
  }
});
```

## Data output

```json
{
  "type": "voiceInput",
  "data": {
    "text": "语音转写后的内容",
    "locale": "zh-CN"
  }
}
```

## Notes
- Requires secure context (HTTPS or localhost) for mic permission in most browsers.
- If browser lacks SpeechRecognition API, tool will show a fallback hint.
