package android.content;
import java.util.*;
public class Intent { public static final String ACTION_VIEW="v"; public static final int URI_INTENT_SCHEME=1, FLAG_ACTIVITY_NEW_TASK=2, FLAG_ACTIVITY_NO_ANIMATION=4, FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS=8;
 public Map<String,Object> extras = new LinkedHashMap<>();
 public Intent(){} public Intent(Context c, Class<?> k){ extras.put("_cls", k.getSimpleName()); } public Intent(String a, android.net.Uri u){}
 public Intent putExtra(String k,String v){extras.put(k,v);return this;} public Intent putExtra(String k,int v){extras.put(k,v);return this;} public Intent putExtra(String k,boolean v){extras.put(k,v);return this;}
 public String getStringExtra(String k){Object o=extras.get(k);return o==null?null:o.toString();} public int getIntExtra(String k,int d){Object o=extras.get(k);return o instanceof Integer?(Integer)o:d;} public boolean hasExtra(String k){return extras.containsKey(k);} public void removeExtra(String k){}
 public Intent setData(android.net.Uri u){return this;} public String action; public Intent setAction(String a){action=a;return this;} public String getAction(){return action;} public String toUri(int f){return "";} public Intent addFlags(int f){return this;} public Intent setClassName(Context c, String n){extras.put("_cls", n.substring(n.lastIndexOf('.')+1));return this;} public String toString(){return extras.toString();} }