import React, { useEffect, useState } from "react";
import { Plus, Youtube, Loader2, Rocket, Eye } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

function extractList(data) {
  if (!data) return [];
  if (data.ok === true && data.data !== undefined) return extractList(data.data);
  if (Array.isArray(data)) return data;
  return data.quizzes || data.items || [];
}

function extractVideoId(ref) {
  if (!ref) return "";
  if (ref.match(/^[a-zA-Z0-9_-]{11}$/)) return ref;
  const m = ref.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : ref;
}

const emptyQuestion = { text: "", choices: ["", ""], correct_choice: 0 };
const emptyQuiz = { title: "", description: "", video_ref: "", questions: [{ ...emptyQuestion }] };

export default function AdminQuizzes() {
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createDialog, setCreateDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("perkSphereQuizzes", { action: "list", filters: {}, scope: "all" });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      setQuizzes(extractList(data));
    } catch (e) {
      const errData = e?.response?.data || {};
      setError(errData.error || e.message || "Failed to load quizzes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addQuestion = () => {
    setCreateDialog({ ...createDialog, quiz: { ...createDialog.quiz, questions: [...createDialog.quiz.questions, { ...emptyQuestion }] } });
  };

  const updateQuestion = (qi, field, value) => {
    const questions = [...createDialog.quiz.questions];
    questions[qi] = { ...questions[qi], [field]: value };
    setCreateDialog({ ...createDialog, quiz: { ...createDialog.quiz, questions } });
  };

  const updateChoice = (qi, ci, value) => {
    const questions = [...createDialog.quiz.questions];
    questions[qi].choices = [...questions[qi].choices];
    questions[qi].choices[ci] = value;
    setCreateDialog({ ...createDialog, quiz: { ...createDialog.quiz, questions } });
  };

  const addChoice = (qi) => {
    const questions = [...createDialog.quiz.questions];
    questions[qi].choices = [...questions[qi].choices, ""];
    setCreateDialog({ ...createDialog, quiz: { ...createDialog.quiz, questions } });
  };

  const save = async () => {
    if (!createDialog) return;
    const quiz = createDialog.quiz;
    if (!quiz.title || !quiz.video_ref) {
      toast({ title: "Validation error", description: "Title and video reference are required.", variant: "destructive" });
      return;
    }
    for (const q of quiz.questions) {
      if (!q.text || q.choices.filter((c) => c.trim()).length < 2) {
        toast({ title: "Validation error", description: "Each question needs text and at least 2 non-empty choices.", variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    try {
      const cleanQuiz = {
        ...quiz,
        video_ref: extractVideoId(quiz.video_ref),
        questions: quiz.questions.map((q) => ({ ...q, choices: q.choices.filter((c) => c.trim()) }))
      };
      const res = await base44.functions.invoke("perkSphereQuizzes", { action: "create", quiz: cleanQuiz });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      toast({ title: "Quiz created", description: "The quiz has been saved as a draft." });
      setCreateDialog(null);
      load();
    } catch (e) {
      const errData = e?.response?.data || {};
      toast({ title: "Creation failed", description: errData.error || e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const publish = async (quizId) => {
    setPublishing(quizId);
    try {
      const res = await base44.functions.invoke("perkSphereQuizzes", { action: "publish", quizId });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      toast({ title: "Quiz published", description: "The quiz is now available to members." });
      load();
    } catch (e) {
      const errData = e?.response?.data || {};
      toast({ title: "Publish failed", description: errData.error || e.message, variant: "destructive" });
    } finally {
      setPublishing(null);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader title="Quiz Manager" description="Create video quizzes with questions and correct answers. Reward payouts are not yet available." />

      <div className="mt-4 flex items-center justify-between">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-xs text-amber-800 dark:text-amber-300">Quiz reward settings are disabled. YouTube viewing awards zero Points and zero XP.</p>
        </div>
        <Button onClick={() => setCreateDialog({ quiz: { ...emptyQuiz, questions: [{ ...emptyQuestion }] } })}>
          <Plus className="mr-2 h-4 w-4" /> Create Quiz
        </Button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Quizzes temporarily unavailable</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
        </div>
      )}

      {!error && (
        <div className="mt-6">
          {quizzes.length === 0 ? (
            <EmptyState title="No quizzes" description="Create quizzes using the button above." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {quizzes.map((q) => (
                <Card key={q.id} className="flex flex-col p-5">
                  <div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-secondary">
                    <Youtube className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold">{q.title}</p>
                  {q.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{q.description}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">{q.question_count || q.questions?.length || 0} questions</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${q.status === "published" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"}`}>
                      {q.status || "draft"}
                    </span>
                    {q.status !== "published" && (
                      <Button size="sm" disabled={publishing === q.id} onClick={() => publish(q.id)}>
                        {publishing === q.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Rocket className="mr-1.5 h-3.5 w-3.5" />} Publish
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={!!createDialog} onOpenChange={(open) => !open && setCreateDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Quiz</DialogTitle>
          </DialogHeader>
          {createDialog && (
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input className="mt-1" value={createDialog.quiz.title} onChange={(e) => setCreateDialog({ ...createDialog, quiz: { ...createDialog.quiz, title: e.target.value } })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea className="mt-1" rows={2} value={createDialog.quiz.description} onChange={(e) => setCreateDialog({ ...createDialog, quiz: { ...createDialog.quiz, description: e.target.value } })} />
              </div>
              <div>
                <Label>YouTube Video URL or ID</Label>
                <Input className="mt-1" value={createDialog.quiz.video_ref} onChange={(e) => setCreateDialog({ ...createDialog, quiz: { ...createDialog.quiz, video_ref: e.target.value } })} placeholder="https://youtube.com/watch?v=... or video ID" />
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Questions</Label>
                  <Button size="sm" variant="outline" onClick={addQuestion}><Plus className="mr-1.5 h-3.5 w-3.5" /> Add Question</Button>
                </div>
                <div className="mt-3 space-y-4">
                  {createDialog.quiz.questions.map((q, qi) => (
                    <div key={qi} className="rounded-xl border border-border p-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Question {qi + 1}</p>
                      <Input value={q.text} onChange={(e) => updateQuestion(qi, "text", e.target.value)} placeholder="Question text..." />
                      <div className="mt-3 space-y-2">
                        {q.choices.map((c, ci) => (
                          <div key={ci} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQuestion(qi, "correct_choice", ci)}
                              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${q.correct_choice === ci ? "border-emerald-500 bg-emerald-500" : "border-border"}`}
                            >
                              {q.correct_choice === ci && <Eye className="h-3 w-3 text-white" />}
                            </button>
                            <Input value={c} onChange={(e) => updateChoice(qi, ci, e.target.value)} placeholder={`Choice ${ci + 1}`} className="flex-1" />
                          </div>
                        ))}
                        <Button size="sm" variant="ghost" onClick={() => addChoice(qi)}><Plus className="mr-1 h-3 w-3" /> Add Choice</Button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">The green circle marks the correct answer (visible to admins only).</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
