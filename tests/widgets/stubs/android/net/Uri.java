package android.net;
public class Uri { public String s=""; public static Uri parse(String s){Uri u=new Uri(); u.s=s; return u;} public static String encode(String s){return s;} public String toString(){return s;} }
