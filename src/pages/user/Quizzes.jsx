import React, { useEffect, useState } from "react";
import { Youtube, Play, Award, History, ArrowLeft, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/perk/PageHeader";
import EmptyState from "@/components/perk/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

function extractList(data, key) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data[key] || data.items || data.data || [];
}

export default function Quizzes() {
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [grade, setGrade] = useState(null);
  const [tab, setTab] = useState("available");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [qRes, hRes] = await Promise.all([
        base44.functions.invoke("perkSphereQuizzes", { action: "list", filters: {} }),
        base44.functions.invoke("perkSphereQuizzes", { action: "history", filters: {} })
      ]);
      const qData = qRes?.data || qRes;
      const hData = hRes?.data || hRes;
      if (qData?.ok === false) throw new Error(qData.error);
      setQuizzes(extractList(qData, "quizzes"));
      setHistory(extractList(hData, "attempts"));
    } catch (e) {
      const errData = e?.response?.data || {};
      setError(errData.error || e.message || "Failed to load quizzes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startQuiz = async (quiz) => {
    setActiveQuiz(quiz);
    setGrade(null);
    setAnswers({});
    setLoadingQuestions(true);
    try {
      const res = await base44.functions.invoke("perkSphereQuizzes", { action: "questions", quizId: quiz.id });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      setQuestions(extractList(data, "questions"));
    } catch (e) {
      const errData = e?.response?.data || {};
      toast({ title: "Failed to load questions", description: errData.error || e.message, variant: "destructive" });
      setActiveQuiz(null);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const submitQuiz = async () => {
    if (!activeQuiz) return;
    const unanswered = questions.filter((q) => answers[q.id] === undefined);
    if (unanswered.length > 0) {
      toast({ title: "Please answer all questions", description: `${unanswered.length} question(s) unanswered.`, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const formattedAnswers = questions.map((q) => ({ question_id: q.id, choice_id: answers[q.id] }));
      const res = await base44.functions.invoke("perkSphereQuizzes", { action: "submit", quizId: activeQuiz.id, answers: formattedAnswers });
      const data = res?.data || res;
      if (data?.ok === false) throw new Error(data.error);
      setGrade(data?.grade || data);
      load();
    } catch (e) {
      const errData = e?.response?.data || {};
      toast({ title: "Submission failed", description: errData.error || e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-foreground" /></div>;
  }

  // Active quiz view
  if (activeQuiz) {
    return (
      <div>
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => { setActiveQuiz(null); setGrade(null); }}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Quizzes
        </Button>
        <PageHeader title={activeQuiz.title} description={activeQuiz.description || "Video quiz"} />

        {activeQuiz.video_ref && (
          <div className="mt-4 aspect-video w-full overflow-hidden rounded-2xl border border-border bg-secondary">
            <iframe
              src={`https://www.youtube.com/embed/${activeQuiz.video_ref}`}
              className="h-full w-full"
              title={activeQuiz.title}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            YouTube viewing awards zero Points and zero XP. Quiz rewards are not yet available.
          </p>
        </div>

        {grade ? (
          <Card className="mt-6 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/15">
                <Award className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-lg font-semibold">Your Grade</p>
                <p className="text-sm text-muted-foreground">
                  Score: {grade.score ?? grade.correct ?? 0} / {grade.total ?? grade.total_questions ?? questions.length}
                  {grade.percentage !== undefined && ` (${grade.percentage}%)`}
                </p>
              </div>
            </div>
            <Button className="mt-4" onClick={() => { setActiveQuiz(null); setGrade(null); }}>Done</Button>
          </Card>
        ) : loadingQuestions ? (
          <div className="flex h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="mt-6 space-y-6">
            {questions.map((q, qi) => (
              <Card key={q.id || qi} className="p-5">
                <p className="text-sm font-medium">{qi + 1}. {q.text || q.question_text}</p>
                <div className="mt-3 space-y-2">
                  {(q.choices || q.options || []).map((c, ci) => {
                    const choiceId = c.id || ci;
                    const selected = answers[q.id] === choiceId;
                    return (
                      <button
                        key={choiceId}
                        onClick={() => setAnswers({ ...answers, [q.id]: choiceId })}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${selected ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-border hover:bg-secondary/50"}`}
                      >
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? "border-indigo-500 bg-indigo-500" : "border-border"}`}>
                          {selected && <CheckCircle2 className="h-4 w-4 text-white" />}
                        </div>
                        {c.text || c.label || c}
                      </button>
                    );
                  })}
                </div>
              </Card>
            ))}
            <Button className="w-full" onClick={submitQuiz} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit Answers
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Quiz list view
  return (
    <div>
      <PageHeader title="Video Quizzes" description="Watch videos and test your knowledge. YouTube viewing awards zero Points and zero XP." />

      {error && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Quizzes temporarily unavailable</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>Retry</Button>
        </div>
      )}

      {!error && (
        <>
          <div className="mt-4 flex gap-2">
            <Button variant={tab === "available" ? "default" : "outline"} size="sm" onClick={() => setTab("available")}>
              <Play className="mr-1.5 h-3.5 w-3.5" /> Available
            </Button>
            <Button variant={tab === "history" ? "default" : "outline"} size="sm" onClick={() => setTab("history")}>
              <History className="mr-1.5 h-3.5 w-3.5" /> History
            </Button>
          </div>

          {tab === "available" && (
            <div className="mt-6">
              {quizzes.length === 0 ? (
                <EmptyState title="No quizzes available" description="Published quizzes will appear here." />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {quizzes.map((q) => (
                    <Card key={q.id} className="flex flex-col p-5">
                      <div className="mb-3 flex h-32 items-center justify-center rounded-xl bg-secondary">
                        <Youtube className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold">{q.title}</p>
                      {q.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{q.description}</p>}
                      <p className="mt-2 text-xs text-muted-foreground">{q.question_count || q.questions_count || 0} questions</p>
                      <Button size="sm" className="mt-3" onClick={() => startQuiz(q)}>
                        <Play className="mr-1.5 h-3.5 w-3.5" /> Take Quiz
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="mt-6">
              {history.length === 0 ? (
                <EmptyState title="No quiz attempts yet" description="Your quiz attempt history will appear here." />
              ) : (
                <div className="space-y-3">
                  {history.map((h, i) => (
                    <Card key={h.id || i} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium">{h.quiz_title || h.title || "Quiz"}</p>
                        <p className="text-xs text-muted-foreground">{new Date(h.submitted_at || h.created_at || Date.now()).toLocaleDateString("en-GB")}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{h.score ?? h.correct ?? 0}/{h.total ?? h.total_questions ?? 0}</span>
                        {(h.percentage ?? 0) >= 50 ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}