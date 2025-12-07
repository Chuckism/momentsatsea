// lib/ai/caption.js

/**
 * Generates a caption suggestion for a photo using your backend API.
 * Always returns a PROMISE resolved to a string.
 */
export async function aiCaption(context = {}) {
    try {
      const res = await fetch("/api/ai-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context)
      });
  
      if (!res.ok) throw new Error("API returned error");
  
      const data = await res.json();
      if (data?.caption) return data.caption;
  
      return "A moment worth remembering.";
    } catch (e) {
      console.warn("AI caption fallback:", e);
      return "A moment worth remembering.";
    }
  }
  