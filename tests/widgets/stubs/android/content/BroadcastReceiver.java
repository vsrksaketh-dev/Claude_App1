package android.content;
public abstract class BroadcastReceiver {
  public static class PendingResult { public void finish() {} }
  public PendingResult goAsync() { return new PendingResult(); }
  public void onReceive(Context c, Intent i) {}
}
