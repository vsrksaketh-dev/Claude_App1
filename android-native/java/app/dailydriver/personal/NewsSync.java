package app.dailydriver.personal;

import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Keeps the News widget fresh without opening the app. The daily routine publishes public news to the repo (data/news.json);
 * this downloads it and swaps it into the stored widget snapshot. Nothing personal is involved. Call it off the main thread.
 */
final class NewsSync {
    private NewsSync() { }

    static final String URL = "https://raw.githubusercontent.com/vsrksaketh-dev/Claude_App1/refs/heads/claude/zealous-cerf-fnwxob/data/news.json";

    /** True when the snapshot now holds a newer set of stories than before. */
    static boolean refresh(Context c) {
        HttpURLConnection h = null;
        try {
            h = (HttpURLConnection) new URL(URL).openConnection();
            h.setConnectTimeout(10000);
            h.setReadTimeout(15000);
            h.setRequestProperty("Cache-Control", "no-cache");
            if (h.getResponseCode() != 200) return false;
            InputStream in = h.getInputStream();
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
            return apply(c, new String(buf.toByteArray(), "UTF-8"));
        } catch (Exception e) {
            return false;
        } finally {
            if (h != null) h.disconnect();
        }
    }

    /** Turns the downloaded file into the compact list the widget reads. Separate from refresh() so it can be tested without a network. */
    static boolean apply(Context c, String body) throws Exception {
        JSONObject j = new JSONObject(body);
        JSONArray items = j.optJSONArray("items");
        if (items == null || items.length() == 0) return false;
        JSONArray out = new JSONArray();
        for (int i = 0; i < items.length() && out.length() < 40; i++) {
            JSONObject x = items.optJSONObject(i);
            if (x == null || "fact".equals(x.optString("kind"))) continue;
            String url = x.optString("url");
            out.put(new JSONObject().put("cat", x.optString("cat")).put("title", x.optString("title")).put("summary", x.optString("summary"))
                .put("why", x.optString("why")).put("src", x.optString("src")).put("url", url.startsWith("http") ? url : ""));
        }
        if (out.length() == 0) return false;
        synchronized (Widgets.class) {
            JSONObject s = Widgets.load(c);
            if (s.length() == 0) return false;          // the app has never run: leave the "open Daily Driver" note alone
            String date = j.optString("date");
            boolean changed = !date.equals(s.optString("newsDate")) || !out.toString().equals(String.valueOf(s.optJSONArray("news")));
            s.put("news", out);
            s.put("newsDate", date);
            Widgets.save(c, s.toString());
            return changed;
        }
    }
}
