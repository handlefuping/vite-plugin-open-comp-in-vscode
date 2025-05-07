import HTML from 'html-parse-stringify'
import { join } from 'path';

const PLUGINNAME = 'open-comp-in-vscode'
const VSCODELINK = 'vscode://file://'
const KEY = 'vite-plugin-meta-key-down'
let scriptContent = `
  /* ${PLUGINNAME}插件注入 */
  document.addEventListener("click", (e) => {
    let current = e.target
    let vscodeLink = current.getAttribute("data-file");
    while (!vscodeLink && current.parentElement && current.parentElement.nodeName != 'BODY') {
      current = current.parentElement
      vscodeLink = current.getAttribute("data-file");
    }
    if (vscodeLink && vscodeLink.startsWith("${VSCODELINK}") && document.body.classList.contains('${KEY}')) {
      let linkElement = document.createElement("a");
      linkElement.setAttribute("href", vscodeLink);
      linkElement.click();
      linkElement.remove();
      linkElement = null;
      /* 三方唤起keyup事件中断 */
      document.body.classList.remove('${KEY}')
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key == "Meta") {
      document.body.classList.add('${KEY}')
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key == "Meta") {
      document.body.classList.remove('${KEY}')
    }
  });
`
const styleContent = `
  /* ${PLUGINNAME}插件注入 */
  .${KEY} [data-file^="${VSCODELINK}"]:hover {
    color: #4078f2
  }
`
const templateReg = /<(template)>([\s\S]*)<\/\1>/

const stepupRenderReg = /(setup\s*\([\s\S]*\s+(?:return|\([^)]*\)\s*=>)\s*\(?\s*)(<([^>]+)>[\s\S]*<\/\3>)(\s*\)?\s*})/

const openCompInVscode = ({
  ext = ['.vue', '.jsx', '.tsx'],
} = {}) => {
  const loadFile = []
  let isDev = false
  let envDir = ''
  return {
    enforce: 'pre',
    name: PLUGINNAME,
    configResolved(resolvedConfig) {
      isDev = resolvedConfig.mode === 'development'
      envDir = resolvedConfig.envDir
    },
    load(id) {
      if (isDev && id.startsWith(join(envDir, 'src')) && ext.some(item => id.endsWith(item))) {
        loadFile.push(id)
      }
    },
    transformIndexHtml(html) {
      if (isDev) {
        
        return {
          html,
          tags: [{
            tag: 'script',
            children: scriptContent,
            injectTo: 'body'
          }, {
            tag: 'style',
            children: styleContent,
            injectTo: 'body'
          }]
        }
      }
      
    },
    transform(code, id) {
      if (loadFile.includes(id)) {
        const transformHtml = (html) => {
          var ast = HTML.parse(html)
          ast.forEach((node) => {
            const { type, name, attrs } = node
            if (type === 'tag' && /^[a-z]+$/.test(name)) {
              attrs['data-file'] = `${VSCODELINK}${id}`
            }
          })
          return HTML.stringify(ast)
        }

        let newCode = code.replace(templateReg, (match, group1, html) => {
          if (!html) {
            return match
          }
          
          return `<template>${transformHtml(html)}</template>`
        })
        newCode = newCode.replace(stepupRenderReg, (match, group1, html, group3, group4) => {
          if (!html) {
            return match
          }
          return `${group1}${transformHtml(html)}${group4}`

        })
        return newCode

      }
    },
  }
}


export default openCompInVscode