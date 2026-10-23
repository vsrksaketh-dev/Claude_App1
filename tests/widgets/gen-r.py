# Writes a stand-in for the generated R class from the widget resources, so the Java can be compiled without the Android SDK.
import glob, os, re, sys
res = 'android-native/res'
ids, layouts, drawables, colors, strings = set(), set(), set(), set(), set()
for f in glob.glob(res + '/**/*.xml', recursive=True):
    t = open(f).read(); d = os.path.basename(os.path.dirname(f)); n = os.path.splitext(os.path.basename(f))[0]
    ids |= set(re.findall(r'@\+id/(\w+)', t))
    if d.startswith('layout'): layouts.add(n)
    if d.startswith('drawable'): drawables.add(n)
    colors |= set(re.findall(r'<color name="(\w+)"', t)); strings |= set(re.findall(r'<string name="(\w+)"', t))
cls = lambda name, items: 'public static final class %s {\n%s\n}' % (name, '\n'.join('public static final int %s = %d;' % (i, k + 1000) for k, i in enumerate(sorted(items))))
os.makedirs(sys.argv[1] + '/app/dailydriver/personal', exist_ok=True)
open(sys.argv[1] + '/app/dailydriver/personal/R.java', 'w').write('package app.dailydriver.personal;\npublic final class R {\n' + ''.join(cls(n, i) for n, i in [('id', ids), ('layout', layouts), ('drawable', drawables), ('color', colors), ('string', strings)]) + '}\n')
