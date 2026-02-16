@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo 开始构建 editorjs-voice-input 插件...

if not exist "node_modules\vite" (
    echo 未检测到 node_modules 或 vite 依赖，先执行 npm install ...
    call npm install
    set INSTALL_RESULT=!ERRORLEVEL!
    if !INSTALL_RESULT! NEQ 0 (
        echo npm install 失败！错误代码: !INSTALL_RESULT!
        exit /b !INSTALL_RESULT!
    )
)

call npm run build
set BUILD_RESULT=!ERRORLEVEL!

echo.
echo 构建完成，返回码: !BUILD_RESULT!

if !BUILD_RESULT! NEQ 0 (
    echo 构建失败！错误代码: !BUILD_RESULT!
    exit /b !BUILD_RESULT!
)

echo 构建成功，开始复制文件到 QNotes/public/vendor/editorjs-voice-input ...
echo.

if not exist "dist\voiceInput.umd.js" (
    echo 错误：找不到 dist\voiceInput.umd.js 文件！
    exit /b 1
)

if not exist "..\..\QNotes\public\vendor\editorjs-voice-input" (
    echo 创建目标目录...
    mkdir "..\..\QNotes\public\vendor\editorjs-voice-input"
    set MKDIR_RESULT=!ERRORLEVEL!
    if !MKDIR_RESULT! NEQ 0 (
        echo 创建目录失败！错误代码: !MKDIR_RESULT!
        exit /b !MKDIR_RESULT!
    )
)

echo 正在复制文件...
copy /Y "dist\voiceInput.umd.js" "..\..\QNotes\public\vendor\editorjs-voice-input\voiceInput.umd.js"
set COPY_RESULT=!ERRORLEVEL!

if !COPY_RESULT! EQU 0 (
    echo 文件复制成功！
) else (
    echo 文件复制失败！错误代码: !COPY_RESULT!
    exit /b !COPY_RESULT!
)

echo.
echo ========================================
echo 完成！editorjs-voice-input 构建与复制已成功执行。
echo ========================================

exit /b 0

