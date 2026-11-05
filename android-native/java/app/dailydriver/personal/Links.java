package app.dailydriver.personal;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Finds the most useful link in an event's description or place: meeting link first, then documents, forms, mail. Mirrors js/links.js. */
final class Links {
    private Links() { }

    private static final Pattern URL = Pattern.compile("https?://[^\\s<>\"'\\]\\)]+", Pattern.CASE_INSENSITIVE);
    private static final Pattern MEET = Pattern.compile("zoom\\.us|teams\\.microsoft\\.com|teams\\.live\\.com|meet\\.google\\.com|webex\\.com|whereby\\.com|gotomeet|bluejeans", Pattern.CASE_INSENSITIVE);
    private static final Pattern FORM = Pattern.compile("forms\\.gle|forms\\.office\\.com|docs\\.google\\.com/forms|joinsuperset\\.com|app\\.joinsuperset", Pattern.CASE_INSENSITIVE);
    private static final Pattern MAIL = Pattern.compile("mail\\.google\\.com", Pattern.CASE_INSENSITIVE);
    private static final Pattern DOC = Pattern.compile("docs\\.google\\.com|drive\\.google\\.com|sheets\\.google|slides\\.google|sharepoint\\.com|onedrive|1drv\\.ms|dropbox\\.com|notion\\.so|canva\\.com|\\.pdf(\\?|#|$)|\\.docx?(\\?|#|$)|\\.pptx?(\\?|#|$)|\\.xlsx?(\\?|#|$)", Pattern.CASE_INSENSITIVE);

    static String kind(String u) {
        if (MEET.matcher(u).find()) return "meet";
        if (FORM.matcher(u).find()) return "form";
        if (MAIL.matcher(u).find()) return "mail";
        if (DOC.matcher(u).find()) return "doc";
        return "link";
    }

    private static int rank(String k) { return "meet".equals(k) ? 0 : "doc".equals(k) ? 1 : "form".equals(k) ? 2 : "mail".equals(k) ? 3 : 4; }

    /** { url, kind } of the best link in the text, or null. */
    static String[] best(String text) {
        if (text == null) return null;
        Matcher m = URL.matcher(text);
        String[] best = null;
        int br = 99;
        while (m.find()) {
            String u = m.group().replaceAll("[.,;:!?]+$", "");
            String k = kind(u);
            if (rank(k) < br) { br = rank(k); best = new String[] { u, k }; }
        }
        return best;
    }

    static String label(String kind) { return "meet".equals(kind) ? "Join" : "doc".equals(kind) ? "Open" : "form".equals(kind) ? "Form" : "mail".equals(kind) ? "Mail" : "Link"; }
}
