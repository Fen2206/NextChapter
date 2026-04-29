import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
  Modal,
  Pressable,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";

const colors = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  border: "#E6E6E6",
  primary: "#111111",
  secondary: "#6B7280",
  buttonPrimary: "#111111",
  buttonText: "#FFFFFF",
};

const spacing = { xs: 6, sm: 10, md: 16 };
const typography = {
  fontSizes: { xs: 12, sm: 14, base: 16 },
  fontWeights: { medium: "500", semibold: "600", bold: "700" },
};

const COLOR_OPTIONS = [
  { name: "Yellow", color: "#FFF59D" },
  { name: "Green", color: "#A5D6A7" },
  { name: "Blue", color: "#90CAF9" },
  { name: "Pink", color: "#F48FB1" },
  { name: "Purple", color: "#CE93D8" },
];

// Save user progress key
function makeProgressKey({ book, url, chapter, userId }) {
  const stable = book?.externalId ?? book?.id ?? url ?? "unknown";
  const uidPart = userId ? `u:${userId}` : "u:anon";
  return `reader:lastPage:${uidPart}:b:${stable}:ch:${chapter}`;
}

export default function ReaderScreen({ route, navigation }) {
  const { book: b, url: paramUrl, bookId: paramBookId, resumePage } = route.params ?? {};
  const chapter = 1;

  const webRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [rawText, setRawText] = useState("");
  const [dark, setDark] = useState(false);
  const [pageInfo, setPageInfo] = useState({ page: 1, total: 1 });
  const [webReady, setWebReady] = useState(false);

  const [userId, setUserId] = useState(null);
  const [internalBookId, setInternalBookId] = useState(null);

  const [highlights, setHighlights] = useState([]);

  // Notes (annotations)
  const [notes, setNotes] = useState([]);
  const [showNotesModal, setShowNotesModal] = useState(false);

  // Add-note flow
  const [pendingSelection, setPendingSelection] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [noteEditorVisible, setNoteEditorVisible] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  const [pickerPos] = useState({ x: 20, y: 300 });

  // restore/saving page
  const [restorePage, setRestorePage] = useState(null);
  const didRestoreRef = useRef(false);
  const saveTimerRef = useRef(null);

  // IMPORTANT: use state for the actual content URL so setUrl works
  const [contentUrl, setContentUrl] = useState(paramUrl ?? null);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Helper: inject JS into webview
  const inject = (code) => {
    if (webRef.current?.injectJavaScript) {
      webRef.current.injectJavaScript(code + " true;");
    }
  };

  const nextPage = () =>
    inject(`(function(){ window.__NC && window.__NC.next && window.__NC.next(); })();`);
  const prevPage = () =>
    inject(`(function(){ window.__NC && window.__NC.prev && window.__NC.prev(); })();`);

  const openPicker = (selection) => {
    setPendingSelection(selection);
    setShowPicker(true);
  };

  const cancelPicker = () => {
    setShowPicker(false);
    setPendingSelection(null);
  };

  // Load user
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!mounted) return;
        setUserId(data?.user?.id ?? null);
      } catch {
        setUserId(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Ensure the book exists in `books` table and capture its internal id
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!b) return;

        const stableKey = `gutenberg:${b.externalId ?? b.id}`;

        const bookRow = {
          google_volume_id: stableKey,
          title: b?.title ?? null,
          authors: b?.author ? [b.author] : null,
          cover_url: b?.cover ?? null,
          page_count: b?.pages ?? null,
        };

        const { data, error } = await supabase
          .from("books")
          .upsert(bookRow, { onConflict: "google_volume_id" })
          .select("id")
          .single();

        if (error) throw error;
        if (mounted) setInternalBookId(Number(data.id));
      } catch (e) {
        console.log("books upsert error:", e?.message ?? e);
        if (mounted) setInternalBookId(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [b]);

  // If no URL was passed, try to load it from books table using paramBookId
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (contentUrl) return;
        if (!paramBookId) return;

        const { data: bookRow, error } = await supabase
          .from("books")
          .select("*")
          .eq("id", paramBookId)
          .single();

        if (!mounted) return;

        if (error) {
          console.warn("couldn't load book row", error);
          return;
        }

        if (bookRow) {
          const candidate =
            bookRow.text_url ??
            bookRow.reader_url ??
            bookRow.content_url ??
            bookRow.url ??
            null;

          if (candidate) setContentUrl(candidate);
        }
      } catch (e) {
        console.warn("fetchBookIfNeeded error", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [paramBookId, contentUrl]);

  // Fetch book text
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!contentUrl) throw new Error("No URL provided");
        const res = await fetch(contentUrl);
        if (!res.ok) throw new Error("Failed to fetch book");
        const txt = await res.text();
        if (!mounted) return;

        // normalize newlines so offsets match
        setRawText(String(txt).replace(/\r\n/g, "\n"));
      } catch (e) {
        Alert.alert("Load failed", e?.message ?? "Could not load book");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [contentUrl]);

  // Load highlights for this user + book + chapter
  useEffect(() => {
    if (!userId || !internalBookId) return;

    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("highlights")
          .select("id, start_offset, end_offset, text_snippet, color, page, created_at")
          .eq("user_id", userId)
          .eq("book_id", internalBookId)
          .eq("chapter", chapter)
          .order("created_at", { ascending: true });

        if (error) throw error;
        if (!mounted) return;

        setHighlights(data ?? []);
      } catch (e) {
        console.log("highlights fetch error:", e?.message ?? e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [userId, internalBookId, chapter]);

  // Load saved page (from storage)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const key = makeProgressKey({ book: b, url: contentUrl, chapter, userId });
        const v = await AsyncStorage.getItem(key);
        if (!mounted) return;

        const p = v ? parseInt(v, 10) : null;

        // If resumePage passed, prefer it
        const preferred = Number.isFinite(resumePage) && resumePage > 0 ? resumePage : p;

        setRestorePage(Number.isFinite(preferred) && preferred > 0 ? preferred : 1);
        didRestoreRef.current = false;
      } catch {
        if (mounted) {
          setRestorePage(1);
          didRestoreRef.current = false;
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [b, contentUrl, chapter, userId, resumePage]);

  // Save "last opened url"
  useEffect(() => {
    if (!userId || !internalBookId || !contentUrl) return;

    const key = `reader:lastOpen:${userId}:book:${internalBookId}`;
    const payload = {
      url: contentUrl,
      book: {
        source: b?.source ?? "gutenberg",
        externalId: b?.externalId ?? b?.id ?? null,
        title: b?.title ?? null,
        author: b?.author ?? null,
        cover: b?.cover ?? null,
      },
    };

    AsyncStorage.setItem(key, JSON.stringify(payload)).catch(() => {});
  }, [userId, internalBookId, contentUrl, b]);

  // Build WebView HTML
  const html = useMemo(() => {
    return `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>
:root{
  --bg:${dark ? "#0B0F17" : "#FDFBF7"};
  --fg:${dark ? "#E6E6E6" : "#1F2328"};
  --fontSize:17px;
}
html,body{
  margin:0; padding:0;
  width:100%; height:100%;
  background:var(--bg);
  color:var(--fg);
  overflow:hidden;
  -webkit-text-size-adjust:100%;
}
#viewport{
  width:100vw;
  height:100vh;
  overflow-x:scroll;
  overflow-y:hidden;
  -webkit-overflow-scrolling:touch;
  scroll-snap-type:x mandatory;
}
#pager{
  height:100vh;
  width:100%;
  column-width:100vw;
  column-gap:0px;
  column-fill:auto;
  padding:70px 0 20px 0;
  box-sizing:border-box;

  font-size:var(--fontSize);
  line-height:1.7;
  font-family:Georgia, "Times New Roman", serif;
}
.p{
  margin:0 0 14px 0;
  padding:0 20px;
  break-inside:avoid;
  -webkit-column-break-inside:avoid;
  overflow-wrap:break-word;
  word-break:break-word;
  hyphens:auto;
}
.hl{
  border-radius:4px;
  padding:0 2px;
}
</style>
</head>

<body>
<div id="viewport">
  <div id="pager"></div>
</div>

<script>
(function(){
  const raw = ${JSON.stringify(rawText || "")};

  const viewport = document.getElementById("viewport");
  const pager = document.getElementById("pager");

  function escapeHTML(s){
    return String(s)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  const parts = raw.split(/\\n\\s*\\n+/g);

  let cursor = 0;
  const paras = parts.map((p) => {
    const found = raw.indexOf(p, cursor);
    const start = found >= 0 ? found : cursor;
    cursor = start + p.length;
    return { text: p, start };
  });

  function renderParagraph(p){
    const txt = p.text || "";
    const pStart = p.start;
    return '<p class="p" data-start="'+pStart+'">'+escapeHTML(txt)+'</p>';
  }

  pager.innerHTML = paras.map(renderParagraph).join("");

  function pageWidth(){ return viewport.clientWidth || 1; }
  function totalPages(){
    const w = pageWidth();
    const totalWidth = pager.scrollWidth || 1;
    return Math.max(1, Math.round(totalWidth / w));
  }
  function currentPage(){
    const w = pageWidth();
    return Math.max(1, Math.round((viewport.scrollLeft || 0) / w) + 1);
  }
  function sendPageInfo(){
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type:"pageInfo",
      page: currentPage(),
      total: totalPages()
    }));
  }
  function go(p){
    const t = totalPages();
    const page = Math.max(1, Math.min(t, p));
    const w = pageWidth();
    const target = (page - 1) * w;
    viewport.scrollLeft = target;
    setTimeout(() => { viewport.scrollLeft = target; sendPageInfo(); }, 60);
  }

  function applyHighlightToParagraph(start_offset, end_offset, color){
    const ps = Array.from(document.querySelectorAll(".p"));
    let target = null;

    for (const p of ps){
      const pStart = parseInt(p.getAttribute("data-start"), 10);
      if (!Number.isFinite(pStart)) continue;
      const pLen = (p.innerText || "").length;
      const pEnd = pStart + pLen;

      if (start_offset >= pStart && end_offset <= pEnd){
        target = { el: p, pStart };
        break;
      }
    }
    if (!target) return false;

    const p = target.el;
    const pStart = target.pStart;

    const localStart = start_offset - pStart;
    const localEnd = end_offset - pStart;

    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null);
    let idx = 0;
    let node;

    while ((node = walker.nextNode())){
      const len = node.textContent.length;
      const nodeStart = idx;
      const nodeEnd = idx + len;

      if (localEnd <= nodeStart) break;

      if (localStart < nodeEnd && localEnd > nodeStart){
        const r = document.createRange();
        r.setStart(node, Math.max(0, localStart - nodeStart));
        r.setEnd(node, Math.min(len, localEnd - nodeStart));

        const span = document.createElement("span");
        span.className = "hl";
        span.style.background = color;

        try {
          r.surroundContents(span);
          return true;
        } catch (e) {
          return false;
        }
      }
      idx += len;
    }
    return false;
  }

  function applyHighlights(list){
    if (!Array.isArray(list)) return;
    for (const h of list){
      if (!h) continue;
      applyHighlightToParagraph(h.start_offset, h.end_offset, h.color);
    }
  }

  function selectionToOffsets(){
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;

    const range = sel.getRangeAt(0);

    let startEl = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
    const p = startEl?.closest?.(".p");
    if (!p) return null;

    let endEl = range.endContainer.nodeType === 3 ? range.endContainer.parentElement : range.endContainer;
    const p2 = endEl?.closest?.(".p");
    if (p2 !== p) return null;

    const pStart = parseInt(p.getAttribute("data-start"), 10);
    if (!Number.isFinite(pStart)) return null;

    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, null);
    let startLocal = 0, endLocal = 0;
    let foundStart = false, foundEnd = false;

    while (walker.nextNode()){
      const node = walker.currentNode;

      if (!foundStart){
        if (node === range.startContainer){
          startLocal += range.startOffset;
          foundStart = true;
        } else {
          startLocal += node.textContent.length;
        }
      }

      if (!foundEnd){
        if (node === range.endContainer){
          endLocal += range.endOffset;
          foundEnd = true;
        } else {
          endLocal += node.textContent.length;
        }
      }

      if (foundStart && foundEnd) break;
    }

    const snippet = sel.toString().slice(0, 240);
    if (!snippet.trim()) return null;

    const start_offset = pStart + startLocal;
    const end_offset = pStart + endLocal;
    if (!(end_offset > start_offset)) return null;

    return { type:"selection", start_offset, end_offset, text_snippet: snippet };
  }

  document.addEventListener("selectionchange", () => {
    clearTimeout(window.__selTimer);
    window.__selTimer = setTimeout(() => {
      const payload = selectionToOffsets();
      if (payload){
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }, 150);
  });

  window.__NC = {
    next:()=>go(currentPage()+1),
    prev:()=>go(currentPage()-1),
    ready:()=>sendPageInfo(),
    go:(p)=>go(p),
    applyHighlightToParagraph,
    applyHighlights
  };

  viewport.addEventListener("scroll", () => {
    if (window.__raf) cancelAnimationFrame(window.__raf);
    window.__raf = requestAnimationFrame(sendPageInfo);
  }, { passive:true });

  window.addEventListener("resize", ()=>{
    const p = currentPage();
    setTimeout(()=>go(p), 120);
  });

  setTimeout(()=>{ window.__NC.ready(); }, 250);
})();
</script>
</body>
</html>`;
  }, [rawText, dark]);

  // After web is ready, restore page and apply highlights
  useEffect(() => {
    if (!webReady) return;

    if (!didRestoreRef.current && Number.isFinite(restorePage) && restorePage > 0) {
      didRestoreRef.current = true;
      inject(`(function(){ window.__NC && window.__NC.go && window.__NC.go(${restorePage}); })();`);
    }

    if (highlights?.length) {
      const list = highlights.map((h) => ({
        start_offset: h.start_offset,
        end_offset: h.end_offset,
        color: h.color,
      }));
      inject(
        `(function(){ window.__NC && window.__NC.applyHighlights && window.__NC.applyHighlights(${JSON.stringify(
          list
        )}); })();`
      );
    }
  }, [webReady, restorePage, highlights]);

  // Save page progress
  const saveProgressThrottled = async (page) => {
    try {
      const key = makeProgressKey({ book: b, url: contentUrl, chapter, userId });

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          await AsyncStorage.setItem(key, String(page));
        } catch {}

        try {
          if (userId && internalBookId) {
            await supabase.from("user_books").upsert(
              {
                user_id: userId,
                book_id: internalBookId,
                status: "reading",
                current_page: page,
              },
              { onConflict: "user_id,book_id" }
            );
          }
        } catch (e) {
          console.log("user_books progress upsert failed:", e?.message ?? e);
        }
      }, 300);
    } catch {}
  };

  // ===== Highlights + Notes helpers =====

  const saveHighlight = async (colorHex) => {
    try {
      if (!pendingSelection) return;

      if (!userId) {
        Alert.alert("Not signed in", "Please sign in to save highlights.");
        cancelPicker();
        return;
      }

      if (!internalBookId) {
        Alert.alert("Book not ready", "Could not resolve internal book id yet.");
        cancelPicker();
        return;
      }

      const payload = {
        user_id: userId,
        book_id: internalBookId,
        chapter,
        start_offset: pendingSelection.start_offset,
        end_offset: pendingSelection.end_offset,
        text_snippet: pendingSelection.text_snippet,
        color: colorHex,
        page: pageInfo.page, // ✅ Option A
      };

      const { data, error } = await supabase.from("highlights").insert(payload).select().single();
      if (error) throw error;

      setHighlights((prev) => [...prev, data]);

      inject(`(function(){
        window.__NC && window.__NC.applyHighlightToParagraph &&
        window.__NC.applyHighlightToParagraph(${data.start_offset}, ${data.end_offset}, "${data.color}");
      })();`);
    } catch (e) {
      Alert.alert("Highlight failed", e?.message ?? "Could not save highlight");
    } finally {
      cancelPicker();
    }
  };

  async function getOrCreateHighlight({
    userId,
    bookId,
    chapter,
    startOffset,
    endOffset,
    snippet,
    page,
  }) {
    const { data: existing, error: findErr } = await supabase
      .from("highlights")
      .select("id")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .eq("chapter", chapter)
      .eq("start_offset", startOffset)
      .eq("end_offset", endOffset)
      .maybeSingle();

    if (findErr) throw findErr;
    if (existing?.id) return existing.id;

    const { data: created, error: insErr } = await supabase
      .from("highlights")
      .insert({
        user_id: userId,
        book_id: bookId,
        chapter,
        start_offset: startOffset,
        end_offset: endOffset,
        text_snippet: snippet,
        page,
        color: "#FFF59D", // optional default, can be changed later
      })
      .select("id")
      .single();

    if (insErr) throw insErr;
    return created.id;
  }

  async function createAnnotation({ userId, highlightId, body }) {
    const { data, error } = await supabase
      .from("annotations")
      .insert({
        user_id: userId,
        highlight_id: highlightId,
        body,
        is_shared: false,
      })
      .select("id, highlight_id, body, created_at, is_shared")
      .single();

    if (error) throw error;
    return data;
  }

  async function loadNotesForPage({ userId, bookId, chapter, page }) {
    const { data: hl, error: hlErr } = await supabase
      .from("highlights")
      .select("id, start_offset, end_offset, text_snippet, page, color")
      .eq("user_id", userId)
      .eq("book_id", bookId)
      .eq("chapter", chapter)
      .eq("page", page);

    if (hlErr) throw hlErr;

    const highlightIds = (hl ?? []).map((h) => h.id);
    if (highlightIds.length === 0) return [];

    const { data: ann, error: annErr } = await supabase
      .from("annotations")
      .select("id, highlight_id, body, created_at, is_shared")
      .eq("user_id", userId)
      .in("highlight_id", highlightIds)
      .order("created_at", { ascending: true });

    if (annErr) throw annErr;

    const hlMap = new Map(hl.map((h) => [h.id, h]));
    return ann.map((a) => ({ ...a, highlight: hlMap.get(a.highlight_id) }));
  }

  // refresh notes when page changes
  useEffect(() => {
    if (!userId || !internalBookId) return;

    loadNotesForPage({
      userId,
      bookId: internalBookId,
      chapter,
      page: pageInfo.page,
    })
      .then(setNotes)
      .catch((e) => console.log("loadNotesForPage error:", e?.message ?? e));
  }, [userId, internalBookId, chapter, pageInfo.page]);

  const handleAddNote = () => {
    if (!pendingSelection) return;

    // open editor
    setNoteText("");
    setNoteEditorVisible(true);
  };

  const saveNote = async () => {
    try {
      if (!pendingSelection) return;

      if (!userId) {
        Alert.alert("Not signed in", "Please sign in to save notes.");
        setNoteEditorVisible(false);
        cancelPicker();
        return;
      }

      if (!internalBookId) {
        Alert.alert("Book not ready", "Could not resolve internal book id yet.");
        setNoteEditorVisible(false);
        cancelPicker();
        return;
      }

      if (!noteText.trim()) {
        Alert.alert("Empty note", "Write something before saving.");
        return;
      }

      setIsSavingNote(true);

      const highlightId = await getOrCreateHighlight({
        userId,
        bookId: internalBookId,
        chapter,
        startOffset: pendingSelection.start_offset,
        endOffset: pendingSelection.end_offset,
        snippet: pendingSelection.text_snippet,
        page: pageInfo.page,
      });

      await createAnnotation({
        userId,
        highlightId,
        body: noteText.trim(),
      });

      // refresh notes for this page
      const refreshed = await loadNotesForPage({
        userId,
        bookId: internalBookId,
        chapter,
        page: pageInfo.page,
      });
      setNotes(refreshed);

      // ensure highlight visible in UI (subtle highlight)
      inject(`(function(){
        window.__NC && window.__NC.applyHighlightToParagraph &&
        window.__NC.applyHighlightToParagraph(${pendingSelection.start_offset}, ${pendingSelection.end_offset}, "#FFF59D");
      })();`);

      setNoteEditorVisible(false);
      cancelPicker();
    } catch (e) {
      Alert.alert("Save note failed", e?.message ?? "Could not save note");
    } finally {
      setIsSavingNote(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading book…</Text>
      </View>
    );
  }

  const notesCountThisPage = notes?.length ?? 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: dark ? "#0B0F17" : colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {b?.title || "Reader"}
          </Text>
          <Text style={styles.headerSubtitle}>
            Page {pageInfo.page} of {pageInfo.total}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {/* Notes button */}
          <TouchableOpacity onPress={() => setShowNotesModal(true)} style={styles.headerButton}>
            <Ionicons name="bookmark" size={24} color={colors.primary} />
            {notesCountThisPage > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notesCountThisPage}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              didRestoreRef.current = false;
              setWebReady(false);
              setDark((d) => !d);
            }}
            style={styles.headerButton}
          >
            <Ionicons name={dark ? "sunny-outline" : "moon-outline"} size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);

            if (msg.type === "pageInfo") {
              setPageInfo({ page: msg.page, total: msg.total });
              setWebReady(true);

              if (Number.isFinite(msg.page)) saveProgressThrottled(msg.page);
              return;
            }

            if (msg.type === "selection") {
              const normalized = {
                ...msg,
                start_offset: msg.start_offset ?? msg.startOffset ?? msg.start,
                end_offset: msg.end_offset ?? msg.endOffset ?? msg.end,
                text_snippet: msg.text_snippet ?? msg.textSnippet ?? msg.snippet,
              };

              if (!Number.isFinite(normalized.start_offset) || !Number.isFinite(normalized.end_offset)) {
                console.log("Bad selection payload:", msg);
                return;
              }

              openPicker(normalized);
              return;
            }
          } catch {
            // ignore
          }
        }}
        style={{ flex: 1 }}
      />

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.bottomButton} onPress={prevPage} disabled={!webReady}>
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
          <Text style={styles.bottomButtonText}>Previous</Text>
        </TouchableOpacity>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(1, Math.round((pageInfo.page / Math.max(1, pageInfo.total)) * 100))}%` },
              ]}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.bottomButton} onPress={nextPage} disabled={!webReady}>
          <Text style={styles.bottomButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Notes list modal */}
      <Modal visible={showNotesModal} transparent animationType="slide" onRequestClose={() => setShowNotesModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowNotesModal(false)}>
          <Pressable style={[styles.pickerCard, { top: 90, left: 20, right: 20, width: undefined }]} onPress={() => {}}>
            <Text style={{ fontWeight: "700", marginBottom: 8 }}>
              Notes — Page {pageInfo.page}
            </Text>

            <View style={{ maxHeight: 320 }}>
              {notesCountThisPage === 0 ? (
                <Text style={{ color: colors.secondary }}>No notes on this page.</Text>
              ) : (
                notes.map((n) => (
                  <Pressable
                    key={String(n.id)}
                    onPress={() => {
                      setShowNotesModal(false);
                      // jump to this page (we’re already filtered by this page, but safe)
                      inject(`(function(){ window.__NC && window.__NC.go && window.__NC.go(${pageInfo.page}); })();`);

                      // re-apply highlight for visibility
                      if (n.highlight?.start_offset != null && n.highlight?.end_offset != null) {
                        inject(`(function(){
                          window.__NC && window.__NC.applyHighlightToParagraph &&
                          window.__NC.applyHighlightToParagraph(${n.highlight.start_offset}, ${n.highlight.end_offset}, "${n.highlight.color || "#FFF59D"}");
                        })();`);
                      }
                    }}
                    style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#eee" }}
                  >
                    <Text numberOfLines={2} style={{ fontWeight: "600" }}>
                      {n.highlight?.text_snippet ?? "Selected text"}
                    </Text>
                    <Text numberOfLines={3} style={{ color: colors.secondary, marginTop: 4 }}>
                      {n.body}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>

            <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "flex-end" }}>
              <TouchableOpacity onPress={() => setShowNotesModal(false)} style={{ padding: 8 }}>
                <Text style={{ color: colors.secondary }}>Close</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Note editor modal */}
      <Modal visible={noteEditorVisible} transparent animationType="fade" onRequestClose={() => setNoteEditorVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setNoteEditorVisible(false)}>
          <Pressable style={[styles.pickerCard, { top: pickerPos.y, left: pickerPos.x, width: 320 }]} onPress={() => {}}>
            <Text style={{ fontWeight: "700", marginBottom: 8 }}>Add note</Text>

            <Text style={{ marginBottom: 8, color: colors.secondary }}>
              {pendingSelection?.text_snippet ?? ""}
            </Text>

            <TextInput
              placeholder="Write your note..."
              multiline
              value={noteText}
              onChangeText={setNoteText}
              style={styles.noteInput}
            />

            <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
              <TouchableOpacity
                onPress={() => setNoteEditorVisible(false)}
                style={{ padding: 8 }}
                disabled={isSavingNote}
              >
                <Text style={{ color: colors.secondary }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={saveNote} style={{ padding: 8 }} disabled={isSavingNote}>
                <Text style={{ fontWeight: "700" }}>{isSavingNote ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Highlight Picker */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={cancelPicker}>
        <Pressable style={styles.overlay} onPress={cancelPicker}>
          <Pressable style={[styles.pickerCard, { top: pickerPos.y, left: pickerPos.x }]} onPress={() => {}}>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map((c) => (
                <TouchableOpacity
                  key={c.name}
                  style={[styles.colorDot, { backgroundColor: c.color }]}
                  onPress={() => saveHighlight(c.color)}
                />
              ))}
            </View>

            <View style={styles.pickerActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  setShowPicker(false);
                  handleAddNote();
                }}
              >
                <Ionicons name="create-outline" size={18} color={colors.secondary} />
                <Text style={styles.actionText}>Add Note</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={cancelPicker}>
                <Ionicons name="close" size={18} color={colors.secondary} />
                <Text style={styles.actionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: { padding: spacing.sm, position: "relative" },
  headerRight: { flexDirection: "row", alignItems: "center" },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: spacing.md },
  headerTitle: {
    fontSize: typography.fontSizes.base,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary,
  },
  headerSubtitle: { fontSize: typography.fontSizes.xs, color: colors.secondary, marginTop: 2 },

  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  bottomButton: { flexDirection: "row", alignItems: "center", padding: spacing.sm, opacity: 1 },
  bottomButtonText: { marginHorizontal: 8, color: colors.primary, fontSize: typography.fontSizes.sm },

  progressContainer: { flex: 1, paddingHorizontal: spacing.sm },
  progressBar: { height: 6, borderRadius: 999, backgroundColor: "#E5E7EB", overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 999, backgroundColor: "#111827" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.2)" },
  pickerCard: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  colorRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB" },

  pickerActions: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  actionText: { marginLeft: 10, color: colors.secondary, fontSize: typography.fontSizes.sm },

  noteInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    textAlignVertical: "top",
  },
});