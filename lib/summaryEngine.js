// lib/summaryEngine.js
// Offline Summary Engine for MomentsAtSea.
// No AI, just deterministic, polished text generation.

function listActivities(activities = []) {
    const titles = activities
      .map(a => a?.title?.trim())
      .filter(Boolean);
  
    if (!titles.length) return "";
  
    if (titles.length === 1) return titles[0];
    if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
    return `${titles.slice(0, -1).join(", ")}, and ${titles[titles.length - 1]}`;
  }
  
  export function generateDaySummary(entry = {}, dayInfo = null) {
    const parts = [];
  
    // 1. Day opener
    const dateLabel = dayInfo
      ? new Date(dayInfo.date + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })
      : "today";
  
    if (dayInfo?.type === "port" && dayInfo.port) {
      const portName = dayInfo.port.split(",")[0];
      parts.push(`Your ${dateLabel} in ${portName} was full of memories.`);
    } else if (dayInfo?.type === "sea") {
      parts.push(`Your ${dateLabel} at sea had its own relaxing rhythm.`);
    } else if (dayInfo?.type === "embarkation") {
      parts.push(`Embarkation day (${dateLabel}) set the tone for your cruise.`);
    } else if (dayInfo?.type === "disembarkation") {
      parts.push(`On ${dateLabel}, you wrapped up your cruise journey.`);
    } else {
      parts.push(`On ${dateLabel}, you added another chapter to your cruise.`);
    }
  
    // 2. Weather
    if (entry.weather) {
      parts.push(`The weather was ${entry.weather.toLowerCase()}, shaping the feel of the day.`);
    }
  
    // 3. Activities
    const activities = entry.activities || [];
    const activityList = listActivities(activities);
    if (activityList) {
      parts.push(`You spent your time enjoying ${activityList.toLowerCase()}.`);
    }
  
    // 4. Exceptional food
    if (entry.exceptionalFood) {
      parts.push(`A standout food moment was ${entry.exceptionalFood.trim()}.`);
    }
  
    // 5. Notes / personal reflections
    if (entry.notes) {
      parts.push(`You noted: "${entry.notes.trim()}", a detail worth remembering.`);
    }
  
    // 6. Photos
    const totalPhotos =
      (entry.photos?.length || 0) +
      (activities.reduce((sum, a) => sum + (a.photos?.length || 0), 0) || 0);
  
    if (totalPhotos > 0) {
      parts.push(`You captured ${totalPhotos} photo${totalPhotos === 1 ? "" : "s"} to remember it all.`);
    }
  
    // 7. Closing
    parts.push("Altogether, it was a day that will fit beautifully into your cruise story and deliverables.");
  
    return parts.join(" ");
  }
  