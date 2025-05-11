import HTML from 'html-parse-stringify'
import babel from '@babel/core'
import { join } from 'path';
import syntaxJsx from '@babel/plugin-syntax-jsx';
import * as t from '@babel/types';

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

// const stepupRenderReg = /(setup\s*\([\s\S]*\s+(?:return|\([^)]*\)\s*=>)\s*\(?\s*)(<([^>]+)>[\s\S]*<\/\3>)(\s*\)?\s*})/
const scriptReg = /(<(script)\s+lang\s*=\s*(['"])jsx\3>)([\s\S]*)<\/\2>/


function plugin() {
  const addAttribute = (jsx, url) => {
    const newAttribute = t.jsxAttribute(t.jsxIdentifier('data-file'), t.stringLiteral(url))
    jsx.node.openingElement.attributes.push(
      newAttribute
    );
  }
  
  return {
    inherits: syntaxJsx.default,
    visitor: {
      Function(path, state) {
        const { url } = state.opts
        if (path.isObjectMethod() && t.isIdentifier(path.node.key, { name: "setup" })) {
          const setupFuncBody = path.get('body').get('body')
          const setupReturnStatement = setupFuncBody[setupFuncBody.length - 1]
          if (setupReturnStatement?.isReturnStatement()) {
            let render = setupReturnStatement.get('argument')
            if (render?.isFunctionDeclaration() || render?.isFunctionExpression() || render?.isArrowFunctionExpression()) {
              let jsx = null
              if (render.get('body')?.isBlockStatement()) {
                const renderFuncBody = render.get('body').get('body')
                const renderReturnStatement = renderFuncBody[renderFuncBody.length - 1]
                if (renderReturnStatement?.isReturnStatement()) {
                  jsx = renderReturnStatement.get('argument')
                }
              } else {
                jsx = render.get('body')
              }
              if (jsx?.isJSXElement()) {
                addAttribute(jsx, url)
              } else if (jsx?.isJSXFragment()) {
                jsx.get('children').forEach(child => {
                  if (child?.isJSXElement()) {
                    addAttribute(child, url)
                  }
                })
              }
            }
          }
        }
      }
    }
  }
}

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
        newCode = newCode.replace(scriptReg, (match, group1, group2, group3, script) => {
          if (!script) {
            return match
          }
          const {code} = babel.transformSync(script, {
            "plugins": [[plugin, {url: `${VSCODELINK}${id}`}]]
          });
          return `${group1}${code}</script>`
        })
        return newCode
      }
    },
  }
}


export default openCompInVscode