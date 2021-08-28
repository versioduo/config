#/bin/sh

set -e

# Read the version from index.html.
name=$(grep 'name="name" content=' index.html | sed -E 's#.*content="(.*)".*#\1#')
version=$(grep 'name="version" content=' index.html | sed -E 's#.*content="(.*)".*#\1#')
date=$(date "+%Y-%m-%d")

# The list of source file as a javascript array.
files=$(find -s\
 css\
 icons\
 js\
 site.webmanifest\
 webfonts\
 -type f)

array=\'./\'
for file in $files; do
  array="$array,\n  \'$file\'"
done

# Create a service-worker script file with the current version and the list of source files.
cp service-worker-template.js service-worker.js
sed -i '' -E "s#__NAME__#$name#" service-worker.js
sed -i '' -E "s#__VERSION__#$version#" service-worker.js
sed -i '' -E "s#__FILES__#$array#" service-worker.js

# Update the date in index.html.
sed -i '' -E 's#name="revised" content=".*"#name="revised" content="'$date'"#' index.html
