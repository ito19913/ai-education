"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false, // 公開サインアップを無効化（既存ユーザーのみ）
      },
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
      return;
    }
    setStatus("sent");
  };

  if (status === "sent") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>メールを送りました</CardTitle>
            <CardDescription>
              {email} に届いたリンクをタップすると、ログイン完了です。
              <br />
              メールアプリを開いて、リンクをタップしてください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              ※ メールが届かない場合は、迷惑メールフォルダもご確認ください。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>AI-Education にログイン</CardTitle>
          <CardDescription>
            メールアドレスを入力すると、ログイン用のリンクを送ります。
            <br />
            パスワードは要りません。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                disabled={status === "sending"}
                autoComplete="email"
              />
            </div>
            {status === "error" && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}
            <Button
              type="submit"
              disabled={status === "sending" || email.length === 0}
            >
              {status === "sending" ? "送信中…" : "ログインリンクを送る"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
