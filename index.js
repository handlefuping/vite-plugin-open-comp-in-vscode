import HTML from 'html-parse-stringify'
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';




const openCompInVscode = ({
  ext = ['.vue', '.jsx', '.tsx'],
  entry = 'main.js'
} = {}) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const loadFile = []
  return {
    enforce: 'pre',
    name: 'open-comp-in-vscode',
    load(id) {
      if (id.startsWith(join(__dirname, 'src')) && ext.some(item => id.endsWith(item))) {
        loadFile.push(id)
      }
    },
    transform(code, id) {
      if (id.startsWith(join(__dirname, 'src')) && id.endsWith(entry)) {
        return code + `

        document.addEventListener("click", (e) => {
          let vscodeLink = e.target.getAttribute("data-file")
          if (vscodeLink && vscodeLink.startsWith("vscode://") && e.metaKey) {
            let linkElement = document.createElement("a");
            linkElement.setAttribute("href", vscodeLink);
            linkElement.click();
            linkElement.remove();
            linkElement = null;
          }
        });
        `
      }
      if (loadFile.includes(id)) {
        let newCode = code.replace(/<template>([\s\S]*)<\/template>/, (match, html) => {
          if (!html) {
            return match
          }
          var ast = HTML.parse(html)

          ast.forEach((node) => {
            const { type, name, attrs } = node
            if (type === 'tag' && /^[a-z]+$/.test(name)) {
              attrs['data-file'] = `vscode://file://${id}`

            }
          })
          return `<template>${HTML.stringify(ast)}</template>`
        })
        return newCode

      }
    },
  }
}


export default openCompInVscode