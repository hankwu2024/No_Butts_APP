# Builds preview-a/b/c.html from the live project.html so every preview carries the exact same content.
import io, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = io.open(os.path.join(root, 'project.html'), encoding='utf-8').read()
FILTER = '<script>\n  var catBtns'
assert src.count(FILTER) == 1 and src.count('</head>') == 1
for v in 'abc':
    s = src.replace('</head>', '<link rel="stylesheet" href="preview/common.css">\n<link rel="stylesheet" href="preview/%s.css">\n</head>' % v)
    s = s.replace(FILTER, '<script src="preview/common.js"></script>\n<script src="preview/%s.js"></script>\n%s' % (v, FILTER))
    io.open(os.path.join(root, 'preview-%s.html' % v), 'w', encoding='utf-8', newline='').write(s)
print('built preview-a/b/c.html')
