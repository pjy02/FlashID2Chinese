@echo off
del .\\FlashID2Chinese.exe

cargo build --release
move .\\target\\release\\FlashID2Chinese.exe .\\FlashID2Chinese.exe
pause