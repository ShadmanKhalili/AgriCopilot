import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HeartHandshake, Loader2, MessageCircle, PhoneCall, SquarePen } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Tab } from '../../nav/tabs';
import { ASSISTANT_NAME, type AssistantHistoryTurn } from '../../constants/assistant';
import { useAuth } from '../AuthProvider';
import { useAppSettings } from '../../context/AppSettingsContext';
import { useUiMode } from '../../context/useUiMode';
import { askAssistant, isAssistantAbort, type AssistantErrorKind } from '../../services/assistant';
import { getTodayReading } from '../../hooks/useTodayWeather';
import { appendMessage, clearThread, getOrCreateMainThread, listMessages } from '../../services/assistantThreads';
import Card from '../ui/Card';
import { AskBar } from './AskBar';
import { EmptyState, FailureCard, MessageBubble, ThinkingBubble } from './ChatParts';
import {
  LOAD_TIMEOUT_MS,
  SAVE_TIMEOUT_MS,
  buildHistory,
  chatItemFromThread,
  cleanQuestion,
  errorKindOf,
  errorView,
  guestStartErrorText,
  helplineText,
  mergeLoadedItems,
  requestLocation,
  textForSave,
  todayForRequest,
  withTimeout,
  type ChatItem,
} from './assistantView';

interface Props {
  lang: 'bn' | 'en';
  /**
   * A question typed or spoken on Home. It is asked once, as soon as the screen
   * is ready. A plain string is a typed question; an object says how it was asked.
   */
  initialQuestion?: string | { text: string; channel: Channel } | null;
  /** Called after `initialQuestion` has been taken, so the caller can clear it. */
  onConsumedInitial?: () => void;
  onOpenTab?: (tab: Tab) => void;
  /**
   * False while another tab is showing (the screen stays mounted). When it turns
   * true again the saved conversation is read again, so what the crop doctor
   * saved meanwhile shows up. Defaults to true.
   */
  active?: boolean;
}

export type Channel = 'text' | 'voice';
type LoadState = 'idle' | 'loading' | 'ready' | 'failed';
type NewMessage = Parameters<typeof appendMessage>[2];

/** One question on its way, or one that failed and can be asked again. */
interface AskSpec {
  question: string;
  channel: Channel;
  history: AssistantHistoryTurn[];
  /** Whether the farmer's own message was saved (it is started before the answer comes back). */
  userSaved: Promise<boolean>;
  /** The conversation this question belongs to; "new chat" starts the next one. */
  gen: number;
}

interface Failure extends AskSpec {
  kind: AssistantErrorKind;
}

/** Clearing deletes the saved messages in batches, so it may take longer than one save. */
const CLEAR_TIMEOUT_MS = 20000;

/**
 * The assistant: one conversation, kept in the farmer's own account.
 *
 * A question goes to the assistant with the last few turns and the farmer's
 * position; the answer comes back with the sources it used. Both messages are
 * saved to the account in the background, and a failed save never hides an
 * answer. The screen works for guests too: a guest is an anonymous account with
 * its own id.
 */
export default function AssistantScreen({ lang, initialQuestion, onConsumedInitial, onOpenTab, active = true }: Props) {
  const bn = lang === 'bn';
  const name = ASSISTANT_NAME[lang];
  const { user, isUserKnown, isGuest, signIn, signInAsGuest } = useAuth();
  const { location } = useAppSettings();
  const mode = useUiMode();
  const uid = user?.uid ?? null;

  const [items, setItems] = useState<ChatItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [reloadKey, setReloadKey] = useState(0);
  // True from the moment the tab is shown again until the saved conversation is read again.
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const threadIdRef = useRef<string | null>(null);
  const uidRef = useRef<string | null>(null);
  const pendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const keyCounterRef = useRef(0);
  /** Counts conversations: "new chat" moves it on, and a save made for an earlier one never writes. */
  const genRef = useRef(0);
  /** Saves that are on their way, so "new chat" can wait for them before it deletes. */
  const savesRef = useRef(new Set<Promise<unknown>>());
  /** Keys of messages made on this phone that the account does not have yet. */
  const unsyncedRef = useRef(new Set<string>());
  const loadStateRef = useRef<LoadState>('idle');
  const refreshingRef = useRef(false);
  const wasActiveRef = useRef(active);
  const initialHandledRef = useRef<string | null>(null);
  const previousCountRef = useRef(0);
  const langRef = useRef(lang);
  const onConsumedRef = useRef(onConsumedInitial);

  useEffect(() => {
    langRef.current = lang;
    onConsumedRef.current = onConsumedInitial;
  });

  const nextKey = () => `local-${++keyCounterRef.current}`;

  const changeLoadState = (next: LoadState) => {
    loadStateRef.current = next;
    setLoadState(next);
  };

  /** Keep a save in the list of saves on their way until it has finished. */
  const track = <T,>(promise: Promise<T>): Promise<T> => {
    const settled = promise.then(
      () => undefined,
      () => undefined
    );
    savesRef.current.add(settled);
    void settled.then(() => savesRef.current.delete(settled));
    return promise;
  };

  /** Stop waiting for an answer that is no longer wanted (new conversation, other account, screen closed). */
  const cancelInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    pendingRef.current = false;
    if (mountedRef.current) setPending(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // Open the farmer's conversation (and make it the first time). Another
  // account starts from a clean screen.
  useEffect(() => {
    let accountChanged = false;
    if (uidRef.current !== uid) {
      accountChanged = true;
      uidRef.current = uid;
      threadIdRef.current = null;
      genRef.current += 1;
      unsyncedRef.current.clear();
      cancelInFlight();
      setItems([]);
      setFailure(null);
      setConfirmingClear(false);
    }
    if (!uid) {
      refreshingRef.current = false;
      setRefreshing(false);
      changeLoadState('idle');
      return;
    }
    let cancelled = false;
    const gen = genRef.current;
    // Reading the conversation again (the tab came back) happens quietly: the
    // messages on screen stay until the new ones arrive.
    const quiet = !accountChanged && loadStateRef.current === 'ready';
    if (!quiet) changeLoadState('loading');
    (async () => {
      try {
        const threadId = await withTimeout(getOrCreateMainThread(uid, langRef.current), LOAD_TIMEOUT_MS);
        const messages = await withTimeout(listMessages(uid, threadId), LOAD_TIMEOUT_MS);
        // Not wanted any more: another run took over, or "new chat" came in meanwhile.
        if (cancelled || gen !== genRef.current) return;
        threadIdRef.current = threadId;
        const saved = messages.map(chatItemFromThread);
        // Anything made on this phone that the account does not have yet stays at the end.
        setItems((current) => mergeLoadedItems(saved, current, unsyncedRef.current));
        changeLoadState('ready');
      } catch (error) {
        if (cancelled || gen !== genRef.current) return;
        console.warn('Could not open the assistant conversation:', error);
        if (!quiet) changeLoadState('failed');
      } finally {
        if (!cancelled) {
          refreshingRef.current = false;
          setRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, reloadKey, cancelInFlight]);

  // The tab was hidden and is shown again: read the saved conversation again.
  useEffect(() => {
    if (active && !wasActiveRef.current && uidRef.current) {
      refreshingRef.current = true;
      setRefreshing(true);
      setReloadKey((key) => key + 1);
    }
    wasActiveRef.current = active;
  }, [active]);

  // Keep the newest message in view.
  const scrollToEnd = useCallback((smooth: boolean) => {
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    endRef.current?.scrollIntoView({ block: 'end', behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    const hadMessages = previousCountRef.current > 0;
    previousCountRef.current = items.length;
    if (items.length === 0 && !pending && !failure) return;
    // The first load jumps straight to the end; later messages glide.
    scrollToEnd(hadMessages);
  }, [items.length, pending, failure, scrollToEnd]);

  // The tab stays mounted while another tab is open. Scrolling does nothing
  // while it is hidden, so scroll again when it comes back.
  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    let wasHidden = element.offsetHeight === 0;
    const observer = new ResizeObserver(() => {
      const hidden = element.offsetHeight === 0;
      if (wasHidden && !hidden) scrollToEnd(false);
      wasHidden = hidden;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [scrollToEnd, uid, isUserKnown]);

  /**
   * Save one message. Never throws: false means it was not saved (the answer is
   * still shown). A save for a conversation that "new chat" has since ended
   * writes nothing.
   */
  const saveMessage = async (message: NewMessage, gen: number): Promise<boolean> => {
    if (!uid || gen !== genRef.current) return false;
    try {
      let threadId = threadIdRef.current;
      if (!threadId) {
        threadId = await withTimeout(getOrCreateMainThread(uid, lang), SAVE_TIMEOUT_MS);
        if (gen === genRef.current) threadIdRef.current = threadId;
      }
      // Checked right before the write, with nothing in between.
      if (gen !== genRef.current) return false;
      await withTimeout(track(appendMessage(uid, threadId, message)), SAVE_TIMEOUT_MS);
      return true;
    } catch (error) {
      console.warn('Could not save the assistant message:', error);
      return false;
    }
  };

  /** Save the answer in the background, then mark it if either message was not kept. */
  const persistAnswer = async (spec: AskSpec, answer: ChatItem) => {
    const [userSaved, answerSaved] = await Promise.all([
      spec.userSaved,
      saveMessage(
        {
          role: 'assistant',
          text: textForSave(answer.text),
          channel: answer.channel,
          ...(answer.toolCalls && answer.toolCalls.length > 0 ? { toolCalls: answer.toolCalls } : {}),
        },
        spec.gen
      ),
    ]);
    if (spec.gen !== genRef.current) return;
    if (answerSaved) unsyncedRef.current.delete(answer.key);
    if (userSaved && answerSaved) return;
    if (mountedRef.current) {
      setItems((current) => current.map((entry) => (entry.key === answer.key ? { ...entry, saved: false } : entry)));
    }
  };

  const ask = async (spec: AskSpec) => {
    const askUid = uid;
    const controller = new AbortController();
    abortRef.current = controller;
    pendingRef.current = true;
    setPending(true);
    setFailure(null);
    try {
      const position = requestLocation(location);
      // The same reading Home shows (its cache), so "can I spray today" and the Home card agree.
      const today = todayForRequest(await getTodayReading(location));
      if (controller.signal.aborted || uidRef.current !== askUid) return;
      const response = await askAssistant(
        {
          message: spec.question,
          lang,
          channel: spec.channel,
          history: spec.history,
          ...(position ? { location: position } : {}),
          ...(today ? { today } : {}),
        },
        controller.signal
      );
      if (controller.signal.aborted || uidRef.current !== askUid) return;
      const answer: ChatItem = {
        key: nextKey(),
        role: 'assistant',
        text: response.text,
        channel: spec.channel,
        createdAt: null,
        toolCalls: response.toolCalls,
        sources: response.sources,
        saved: true,
      };
      setItems((current) => [...current, answer]);
      unsyncedRef.current.add(answer.key);
      void persistAnswer(spec, answer);
    } catch (error) {
      if (controller.signal.aborted || isAssistantAbort(error) || uidRef.current !== askUid) return;
      setFailure({ ...spec, kind: errorKindOf(error) });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        pendingRef.current = false;
        if (mountedRef.current) setPending(false);
      }
    }
  };

  const send = (rawText: string, channel: Channel) => {
    const question = cleanQuestion(rawText);
    if (!question || !uid || pendingRef.current) return;
    // The history is what was said before this question.
    const history = buildHistory(items);
    const gen = genRef.current;
    const userKey = nextKey();
    setItems((current) => [...current, { key: userKey, role: 'user', text: question, channel, createdAt: null, saved: true }]);
    unsyncedRef.current.add(userKey);
    const userSaved = saveMessage({ role: 'user', text: question, channel }, gen).then((ok) => {
      if (ok && gen === genRef.current) unsyncedRef.current.delete(userKey);
      return ok;
    });
    void ask({ question, channel, history, userSaved, gen });
  };

  const retry = () => {
    if (!failure || pendingRef.current || failure.gen !== genRef.current) return;
    const { kind: _kind, ...spec } = failure;
    void ask(spec);
  };

  // A question from Home: ask it once, when the conversation is open.
  const sendRef = useRef(send);
  sendRef.current = send;
  const initialText = typeof initialQuestion === 'string' ? initialQuestion : initialQuestion?.text ?? null;
  const initialChannel: Channel = typeof initialQuestion === 'object' && initialQuestion?.channel === 'voice' ? 'voice' : 'text';
  useEffect(() => {
    if (!initialText) {
      initialHandledRef.current = null;
      return;
    }
    // Wait while the saved conversation is being read again, so the history sent is complete.
    if (!uid || loadState === 'idle' || loadState === 'loading' || pendingRef.current || refreshingRef.current) return;
    const handledKey = `${initialChannel}:${initialText}`;
    if (initialHandledRef.current === handledKey) return;
    initialHandledRef.current = handledKey;
    sendRef.current(initialText, initialChannel);
    onConsumedRef.current?.();
  }, [initialText, initialChannel, uid, loadState, pending, refreshing]);

  const confirmClear = async () => {
    if (!uid || clearing) return;
    // From here on, every save made for this conversation writes nothing.
    genRef.current += 1;
    cancelInFlight();
    setClearing(true);
    try {
      // A write that was already on its way must land before the delete, or it would survive it.
      await withTimeout(Promise.allSettled([...savesRef.current]), SAVE_TIMEOUT_MS).catch(() => undefined);
      const threadId = threadIdRef.current ?? (await withTimeout(getOrCreateMainThread(uid, lang), SAVE_TIMEOUT_MS));
      threadIdRef.current = threadId;
      await withTimeout(clearThread(uid, threadId), CLEAR_TIMEOUT_MS);
      unsyncedRef.current.clear();
      if (!mountedRef.current) return;
      setItems([]);
      setFailure(null);
      setConfirmingClear(false);
    } catch (error) {
      console.warn('Could not clear the assistant conversation:', error);
      toast.error(bn ? 'মুছে ফেলা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।' : 'Could not delete it. Check your connection and try again.');
    } finally {
      if (mountedRef.current) setClearing(false);
    }
  };

  const startGuest = async () => {
    setGuestBusy(true);
    setGuestError(null);
    try {
      await signInAsGuest();
    } catch (error) {
      console.warn('Guest sign-in failed:', error);
      setGuestError(guestStartErrorText(error, lang));
    } finally {
      setGuestBusy(false);
    }
  };

  // ---- Not signed in -------------------------------------------------------

  if (!isUserKnown) {
    return (
      <div ref={rootRef} className="max-w-xl mx-auto w-full flex items-center justify-center gap-3 py-12 text-stone-700 dark:text-stone-300" role="status">
        <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
        <span className="text-base font-bold">{bn ? 'লোড হচ্ছে...' : 'Loading...'}</span>
      </div>
    );
  }

  if (!uid) {
    return (
      <div ref={rootRef} className="max-w-xl mx-auto w-full space-y-4">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-white">{name}</h1>
        <Card className="text-center space-y-3">
          <MessageCircle className="w-10 h-10 mx-auto text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          <p className="text-lg font-bold text-stone-900 dark:text-white">
            {bn ? 'কথা বলতে শুরু করুন' : 'Start a conversation'}
          </p>
          <p className="text-base leading-relaxed text-stone-700 dark:text-stone-300">
            {bn
              ? 'শুরু করতে একটি অ্যাকাউন্ট লাগে, যাতে আপনার কথাগুলো আপনার অ্যাকাউন্টে জমা থাকে। পাসওয়ার্ড লাগবে না: গেস্ট হিসেবে এক ট্যাপে শুরু করা যায়।'
              : 'You need an account to start, so your conversations are kept in it. No password needed: you can start as a guest in one tap.'}
          </p>
          {guestError && (
            <p className="text-base font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-xl px-3 py-2">
              {guestError}
            </p>
          )}
          <button
            type="button"
            onClick={startGuest}
            disabled={guestBusy}
            className="w-full min-h-[56px] rounded-2xl bg-emerald-700 text-white text-lg font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {guestBusy ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : <HeartHandshake className="w-5 h-5" aria-hidden="true" />}
            <span>{bn ? 'গেস্ট হিসেবে শুরু করুন' : 'Start as a guest'}</span>
          </button>
          <button
            type="button"
            onClick={() => signIn().catch(() => {})}
            className="w-full min-h-[56px] rounded-2xl border-2 border-emerald-700 text-emerald-800 dark:text-emerald-300 text-lg font-bold active:scale-[0.98] transition-transform"
          >
            {bn ? 'Google দিয়ে সাইন ইন' : 'Sign in with Google'}
          </button>
          <a
            href="tel:16123"
            className="flex items-center justify-center gap-2 min-h-[48px] text-base font-bold text-amber-800 dark:text-amber-300"
          >
            <PhoneCall className="w-5 h-5" aria-hidden="true" />
            <span>{helplineText(lang)}</span>
          </a>
        </Card>
      </div>
    );
  }

  // ---- The conversation ----------------------------------------------------

  const barOffset =
    mode === 'simple'
      ? 'bottom-[calc(3.75rem+env(safe-area-inset-bottom))]'
      : 'bottom-[calc(3.75rem+env(safe-area-inset-bottom))] md:bottom-2';
  const showEmpty = items.length === 0 && !pending && !failure && loadState !== 'loading' && loadState !== 'idle';
  const canClear = (items.length > 0 || failure !== null) && !confirmingClear;
  // The Ask bar rests on the bottom bar. Layout leaves 7rem under the page for
  // that bar; pulling the end of this screen down by 3rem puts the Ask bar
  // right above it, also when the conversation is short or scrolled to the end.
  const bottomPull = mode === 'simple' ? '-mb-12' : '-mb-12 md:mb-0';

  return (
    <div ref={rootRef} className={`max-w-xl mx-auto w-full flex flex-col gap-3 min-h-[calc(100dvh-8.5rem)] ${bottomPull}`}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900 dark:text-white min-w-0">
          <MessageCircle className="w-7 h-7 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
          <span className="truncate">{name}</span>
        </h1>
        {canClear && (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            className="shrink-0 inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-2xl border-2 border-stone-300 dark:border-emerald-900/60 bg-white dark:bg-[#0c1c13] text-base font-bold text-stone-800 dark:text-stone-100 active:scale-[0.98] transition-transform"
          >
            <SquarePen className="w-5 h-5" aria-hidden="true" />
            <span>{bn ? 'নতুন কথা' : 'New chat'}</span>
          </button>
        )}
      </div>

      {confirmingClear && (
        <div
          role="group"
          aria-label={bn ? 'নতুন কথা শুরু করবেন?' : 'Start a new conversation?'}
          className="rounded-2xl border-2 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 space-y-3"
        >
          <p className="text-base font-bold leading-snug text-stone-900 dark:text-white">
            {bn
              ? 'নতুন করে শুরু করবেন? এখনকার সব কথা মুছে যাবে, ফিরে পাবেন না।'
              : 'Start again? Everything said so far will be deleted and cannot be brought back.'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => setConfirmingClear(false)}
              disabled={clearing}
              className="min-h-[48px] rounded-2xl border-2 border-stone-300 dark:border-emerald-900/60 bg-white dark:bg-[#0c1c13] text-base font-bold text-stone-800 dark:text-stone-100 active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {bn ? 'না, থাক' : 'No, keep it'}
            </button>
            <button
              type="button"
              onClick={confirmClear}
              disabled={clearing}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-2xl bg-red-700 text-white text-base font-bold active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {clearing && <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />}
              <span>{bn ? 'হ্যাঁ, নতুন করে শুরু' : 'Yes, start again'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-3">
        {loadState === 'loading' && (
          <div className="flex items-center justify-center gap-3 py-6 text-stone-700 dark:text-stone-300" role="status">
            <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
            <span className="text-base font-bold">{bn ? 'আগের কথা আনা হচ্ছে...' : 'Opening your conversation...'}</span>
          </div>
        )}

        {loadState === 'failed' && (
          <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-base leading-snug text-stone-900 dark:text-stone-100">
              {bn ? 'আগের কথা আনা যায়নি। নতুন প্রশ্ন করতে পারেন।' : 'Your earlier conversation could not be opened. You can still ask.'}
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((key) => key + 1)}
              className="min-h-[48px] px-4 rounded-2xl border-2 border-emerald-700 text-emerald-800 dark:text-emerald-300 text-base font-bold active:scale-[0.98] transition-transform"
            >
              {bn ? 'আবার চেষ্টা করুন' : 'Try again'}
            </button>
          </div>
        )}

        {showEmpty && (
          <EmptyState
            lang={lang}
            onPick={(question) => send(question, 'text')}
            isGuest={isGuest}
            onOpenProfile={onOpenTab ? () => onOpenTab('profile') : undefined}
          />
        )}

        {items.length > 0 && (
          <div className="space-y-3" role="log" aria-label={bn ? 'কথোপকথন' : 'Conversation'}>
            {items.map((item) => (
              <MessageBubble key={item.key} item={item} lang={lang} />
            ))}
          </div>
        )}

        {pending && <ThinkingBubble lang={lang} />}
        {failure && <FailureCard view={errorView(failure.kind, lang)} lang={lang} onRetry={retry} />}
        <div ref={endRef} aria-hidden="true" />
      </div>

      <div className={`sticky z-20 ${barOffset}`}>
        <div className="rounded-3xl bg-white dark:bg-[#0c1c13] border border-stone-200 dark:border-emerald-900/50 shadow-lg p-3">
          <AskBar lang={lang} onAsk={send} disabled={pending || loadState === 'loading' || clearing} />
        </div>
      </div>
    </div>
  );
}
