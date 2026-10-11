#!/bin/bash
# MKV test movies (from the MKV converter work)
set -e
cd "$(dirname "$0")"
mkdir -p Movies && cd Movies
rm -f *.mkv *.srt *.ass
cat > subs.srt <<'EOF'
1
00:00:01,000 --> 00:00:03,000
Welcome to the <i>LANscape</i> drive-in.

2
00:00:04,500 --> 00:00:06,000
Please turn off your pagers.

3
00:00:08,000 --> 00:00:10,500
Enjoy the feature presentation!
EOF
cat > subs.ass <<'EOF'
[Script Info]
ScriptType: v4.00+
PlayResX: 320
PlayResY: 240

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,16,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\b1}Hello,{\b0} world\Nsecond line
Dialogue: 0,0:00:05.00,0:00:07.50,Default,,0,0,0,,Commas, in, text
EOF
V="-f lavfi -i testsrc2=size=320x240:rate=24:duration=12"
A2="-f lavfi -i sine=frequency=440:sample_rate=44100:duration=12"
A48="-f lavfi -i sine=frequency=330:sample_rate=48000:duration=12"
X264="-c:v libx264 -preset veryfast -bf 3 -b_strategy 0 -x264-params b-pyramid=normal -g 48 -pix_fmt yuv420p"
set -x
ffmpeg -v error -y $V $A2 -i subs.srt -map 0 -map 1 -map 2 $X264 -c:a aac -b:a 96k -ac 2 -c:s srt -metadata:s:s:0 language=eng h264_aac.mkv
ffmpeg -v error -y $V $A48 -map 0 -map 1 -c:v libx265 -preset ultrafast -x265-params bframes=4:b-pyramid=1:log-level=error -g 48 -pix_fmt yuv420p -c:a ac3 -b:a 384k -ac 6 hevc_ac3.mkv
ffmpeg -v error -y $V $A48 -map 0 -map 1 $X264 -c:a eac3 -b:a 192k -ac 2 h264_eac3.mkv
ffmpeg -v error -y $V $A2 -map 0 -map 1 $X264 -c:a libmp3lame -b:a 128k h264_mp3.mkv
ffmpeg -v error -y $V $A48 -map 0 -map 1 $X264 -c:a flac h264_flac.mkv
ffmpeg -v error -y $V $A48 -map 0 -map 1 $X264 -c:a dca -strict -2 h264_dts.mkv
ffmpeg -v error -y $V $A48 -i subs.ass -map 0 -map 1 -map 2 -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -b:v 300k -g 48 -c:a libopus -b:a 64k -c:s ass vp9_opus.mkv
ffmpeg -v error -y $V $A2 -map 0 -map 1 $X264 -c:a aac -b:a 96k -live 1 live.mkv
ffmpeg -v error -y -f lavfi -i testsrc2=size=320x240:rate=24:duration=12 $A48 -map 0 -map 1 -c:v libsvtav1 -preset 12 -g 48 -c:a libopus -b:a 64k av1_opus.mkv
ffmpeg -v error -y -f lavfi -i testsrc2=size=480x270:rate=25:duration=75 -f lavfi -i "sine=frequency=500:sample_rate=48000:duration=75" -map 0 -map 1 -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -b:v 250k -g 50 -c:a libopus -b:a 48k long_vp9.mkv
ffmpeg -v error -y -f lavfi -i testsrc2=size=480x270:rate=25:duration=75 -f lavfi -i "sine=frequency=500:sample_rate=48000:duration=75" -map 0 -map 1 -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -b:v 250k -g 50 -c:a libopus -b:a 48k -live 1 long_live.mkv
set +x

ffmpeg -v error -y -f lavfi -i testsrc2=size=320x240:rate=24:duration=6 -f lavfi -i sine=frequency=330:sample_rate=48000:duration=6 -f lavfi -i sine=frequency=550:sample_rate=44100:duration=6 -f lavfi -i sine=frequency=660:sample_rate=44100:duration=6 -map 0 -map 1 -map 2 -map 3 -c:v libx264 -preset veryfast -g 48 -pix_fmt yuv420p -c:a:0 ac3 -c:a:1 aac -c:a:2 aac -metadata:s:a:0 title=Surround -metadata:s:a:1 "title=Director Commentary" -metadata:s:a:2 title=Stereo -metadata:s:a:0 language=eng -metadata:s:a:1 language=eng -metadata:s:a:2 language=eng -disposition:a:0 default -disposition:a:1 0 -disposition:a:2 0 multi_audio.mkv
