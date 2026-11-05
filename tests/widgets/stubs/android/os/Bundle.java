package android.os;
public class Bundle { public int h, w; public int getInt(String k,int d){ return k.equals("h")?h:k.equals("w")?w:d; } }