/**
 * Multi-Channel Notification Service
 * Handles job alerts via Email, Telegram, and WhatsApp
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8791693766:AAFELIDnqUDAAt4tBVmEuJ6z4hog6DkF_X4";

interface JobAlert {
  title: string;
  company: string;
  location: string;
  salary?: string;
  url: string;
  matchScore: number;
}

interface UserNotificationPrefs {
  notify_email: boolean;
  notify_telegram: boolean;
  notify_whatsapp: boolean;
  telegram_chat_id?: string;
  email: string;
}

/**
 * Send Telegram message via bot API
 */
export async function sendTelegramMessage(chatId: string, message: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      console.error(`Telegram API error: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return false;
  }
}

/**
 * Format job alerts for Telegram
 */
function formatTelegramJobAlert(jobs: JobAlert[]): string {
  if (jobs.length === 0) {
    return "🎯 <b>VentureApply Job Alert</b>\n\nNo new matching jobs found today. Keep your CV updated!";
  }

  const header = `🎯 <b>VentureApply Job Alert</b>\n\n📋 Found ${jobs.length} new matching job${jobs.length > 1 ? "s" : ""}:\n\n`;

  const jobList = jobs
    .slice(0, 10) // Limit to 10 jobs per message
    .map((job, i) => {
      const score = job.matchScore >= 80 ? "🟢" : job.matchScore >= 60 ? "🟡" : "⚪";
      const salary = job.salary ? ` 💰 ${job.salary}` : "";
      return `${i + 1}. ${score} <b>${job.title}</b>\n   🏢 ${job.company}\n   📍 ${job.location}${salary}\n   🔗 <a href="${job.url}">Apply Now</a>\n`;
    })
    .join("\n");

  const footer = jobs.length > 10 ? `\n...and ${jobs.length - 10} more jobs` : "";

  return header + jobList + footer;
}

/**
 * Send email notification (placeholder - requires email service integration)
 */
export async function sendEmailNotification(email: string, subject: string, body: string): Promise<boolean> {
  // TODO: Integrate with email service (Resend, SendGrid, etc.)
  console.log(`[EMAIL] To: ${email}, Subject: ${subject}`);
  console.log(`[EMAIL] Body: ${body}`);
  return true;
}

/**
 * Send WhatsApp notification (placeholder - requires WhatsApp API integration)
 */
export async function sendWhatsAppNotification(phone: string, message: string): Promise<boolean> {
  // TODO: Integrate with WhatsApp Business API or use WhatsApp link
  // For now, generate a WhatsApp deep link
  console.log(`[WHATSAPP] To: ${phone}`);
  console.log(`[WHATSAPP] Message: ${message}`);
  return true;
}

/**
 * Send job alerts to all enabled channels for a user
 */
export async function sendJobAlerts(
  jobs: JobAlert[],
  userPrefs: UserNotificationPrefs
): Promise<{ email: boolean; telegram: boolean; whatsapp: boolean }> {
  const results = {
    email: false,
    telegram: false,
    whatsapp: false,
  };

  // Format the job alert message
  const telegramMessage = formatTelegramJobAlert(jobs);
  const emailSubject = `🎯 ${jobs.length} New Job Matches - VentureApply`;
  const emailBody = formatEmailJobAlert(jobs);
  const whatsappMessage = formatWhatsAppJobAlert(jobs);

  // Send to each enabled channel
  if (userPrefs.notify_email && userPrefs.email) {
    results.email = await sendEmailNotification(userPrefs.email, emailSubject, emailBody);
  }

  if (userPrefs.notify_telegram && userPrefs.telegram_chat_id) {
    results.telegram = await sendTelegramMessage(userPrefs.telegram_chat_id, telegramMessage);
  }

  if (userPrefs.notify_whatsapp) {
    // TODO: Get user's phone number from profile
    results.whatsapp = await sendWhatsAppNotification("", whatsappMessage);
  }

  return results;
}

/**
 * Format job alerts for email
 */
function formatEmailJobAlert(jobs: JobAlert[]): string {
  if (jobs.length === 0) {
    return "No new matching jobs found today. Keep your CV updated!";
  }

  const jobList = jobs
    .slice(0, 10)
    .map((job) => {
      const salary = job.salary ? `Salary: ${job.salary}\n` : "";
      return `
        <h3>${job.title}</h3>
        <p><strong>Company:</strong> ${job.company}</p>
        <p><strong>Location:</strong> ${job.location}</p>
        <p>${salary}<a href="${job.url}">Apply Now</a></p>
        <hr>
      `;
    })
    .join("");

  return `<h2>Found ${jobs.length} new matching jobs:</h2>${jobList}`;
}

/**
 * Format job alerts for WhatsApp
 */
function formatWhatsAppJobAlert(jobs: JobAlert[]): string {
  if (jobs.length === 0) {
    return "🎯 VentureApply: No new matching jobs today. Keep your CV updated!";
  }

  const jobList = jobs
    .slice(0, 5) // WhatsApp has character limits
    .map((job, i) => {
      return `${i + 1}. ${job.title} at ${job.company} (${job.location})\n${job.url}`;
    })
    .join("\n\n");

  return `🎯 VentureApply Job Alert\n\nFound ${jobs.length} new jobs:\n\n${jobList}`;
}

/**
 * Telegram Bot Webhook Handler (for /start, /help, etc.)
 * This would be called from an API endpoint
 */
export async function handleTelegramWebhook(update: any): Promise<void> {
  const { message } = update;
  
  if (!message) return;

  const chatId = message.chat.id.toString();
  const text = message.text || "";

  // Handle /start command
  if (text === "/start") {
    await sendTelegramMessage(
      chatId,
      "👋 Welcome to VentureApply!\n\n" +
      "You'll receive job alerts here based on your preferences.\n\n" +
      "Commands:\n" +
      "/status - Check your notification settings\n" +
      "/jobs - Get your latest job matches\n" +
      "/stop - Pause notifications"
    );
    return;
  }

  // Handle /help command
  if (text === "/help") {
    await sendTelegramMessage(
      chatId,
      "📖 VentureApply Bot Help\n\n" +
      "This bot sends you job alerts based on your preferences.\n" +
      "Set up your alerts in the VentureApply dashboard.\n\n" +
      "Commands:\n" +
      "/start - Get started\n" +
      "/status - Check settings\n" +
      "/jobs - Get job matches\n" +
      "/stop - Pause notifications"
    );
    return;
  }

  // Handle unknown commands
  await sendTelegramMessage(
    chatId,
    "🤖 I'm not sure I understand that command.\n" +
    "Try /help for available commands."
  );
}

/**
 * Generate WhatsApp deep link for sharing
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encodedMessage}`;
}

/**
 * Run daily job search and send notifications
 * This would be called by a cron job or scheduled function
 */
export async function runDailyJobNotificationScan(): Promise<void> {
  // This function would:
  // 1. Fetch all users with notifications enabled
  // 2. For each user, run job search based on their preferences
  // 3. Send notifications via their preferred channels
  
  console.log("[CRON] Running daily job notification scan...");
  
  // TODO: Implement actual scan logic
  // For now, just log
  console.log("[CRON] Daily scan complete");
}
