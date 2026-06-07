"use client";

/**
 * useSpeechRecognition — ブラウザ標準の音声認識フック (レジュメ構想 R4、2026-06-07)
 *
 * Web Speech API (`webkitSpeechRecognition` / `SpeechRecognition`) を React から使う薄い
 * ラッパー。レジュメを「話して書く」ための入力に使う。無料・Chrome 内蔵・日本語対応。
 * - supported: ブラウザが対応しているか (false なら 🎤 を隠してテキストのみで成立)
 * - listening: 録音中か
 * - interim: まだ確定していない聞き取り途中テキスト (薄く live 表示用)
 * - start(onFinal): 録音開始。確定した断片ごとに onFinal(text) が呼ばれる (追記する想定)
 * - stop(): 録音停止
 *
 * 注: Chrome は無音が続くと自動で onend → listening=false になる (自動再開はしない、
 * 子が必要なら再度 🎤 を押す = R4 未決の「明示停止のみ」方針)。localhost/https 必須。
 */

import { useCallback, useEffect, useRef, useState } from "react";

type UseSpeechRecognitionResult = {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string | null;
  start: (onFinal: (text: string) => void) => void;
  stop: () => void;
};

export function useSpeechRecognition(opts?: {
  lang?: string;
}): UseSpeechRecognitionResult {
  const lang = opts?.lang ?? "ja-JP";
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const onFinalRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(!!Ctor);
  }, []);

  const start = useCallback(
    (onFinal: (text: string) => void) => {
      if (typeof window === "undefined") return;
      const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (!Ctor) {
        setError("not-supported");
        return;
      }
      if (recRef.current) return; // 既に録音中
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      onFinalRef.current = onFinal;
      rec.onresult = (ev) => {
        let interimText = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const res = ev.results[i];
          const txt = res[0]?.transcript ?? "";
          if (res.isFinal) {
            onFinalRef.current?.(txt);
          } else {
            interimText += txt;
          }
        }
        setInterim(interimText);
      };
      rec.onerror = (ev) => {
        // 無音・手動停止は通常運用なので無視。権限拒否等だけ表面化。
        if (ev.error === "no-speech" || ev.error === "aborted") return;
        setError(ev.error);
      };
      rec.onend = () => {
        setListening(false);
        setInterim("");
        recRef.current = null;
      };
      recRef.current = rec;
      setError(null);
      setListening(true);
      try {
        rec.start();
      } catch {
        // 連打などで既に開始済みの場合は無視。
      }
    },
    [lang],
  );

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  // アンマウント時は確実に停止 (マイクを掴みっぱなしにしない)。
  useEffect(() => {
    return () => {
      recRef.current?.abort();
      recRef.current = null;
    };
  }, []);

  return { supported, listening, interim, error, start, stop };
}
