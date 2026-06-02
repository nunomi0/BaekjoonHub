/*
  문제가 맞았다면 문제 관련 데이터를 파싱하는 함수의 모음입니다.
  모든 해당 파일의 모든 함수는 parseData()를 통해 호출됩니다.
*/

/*
  bojData를 초기화하는 함수로 문제 요약과 코드를 파싱합니다.
  - directory : 레포에 기록될 폴더명
  - message : 커밋 메시지
  - fileName : 파일명
  - code : 소스코드 내용
*/
function textFromSelector(selectors, root = document) {
  const el = root.querySelector(selectors);
  return el?.textContent?.replace(/\n/g, '').trim() || '';
}

function reconstructFillBlankCode(node) {
  if (isNull(node)) return '';
  let result = '';
  for (const child of node.childNodes) {
    if (child.tagName === 'INPUT' || child.tagName === 'TEXTAREA') {
      result += child.value;
    } else if (child.childNodes && child.childNodes.length > 0) {
      result += reconstructFillBlankCode(child);
    } else {
      result += child.textContent || '';
    }
  }
  return result;
}

function cleanUrl(url) {
  return `${url || ''}`.replace(/[?#].*$/g, '').trim();
}

function normalizeProblemUrl(url) {
  try {
    const parsed = new URL(cleanUrl(url), window.location.origin);
    const lessonPath = parsed.pathname.match(/\/learn\/courses\/30\/lessons\/\d+/)?.[0];
    return lessonPath ? `https://school.programmers.co.kr${lessonPath}` : '';
  } catch (error) {
    return '';
  }
}

function getProblemLink() {
  const problemId = getProblemId();
  const currentLessonPath = window.location.pathname.match(/\/learn\/courses\/30\/lessons\/\d+/)?.[0];
  const fallbackLessonPath = currentLessonPath || (problemId ? `/learn/courses/30/lessons/${problemId}` : '');
  const candidates = [
    fallbackLessonPath ? `https://school.programmers.co.kr${fallbackLessonPath}` : '',
    document.querySelector('link[rel="canonical"]')?.href,
    document.querySelector('meta[property="og:url"]')?.content,
    document.querySelector('meta[name="twitter:url"]')?.content,
    document.querySelector('head > meta[name$=url]')?.content,
    window.location.href,
  ];
  return candidates.map(normalizeProblemUrl).find(Boolean) || cleanUrl(window.location.href);
}

function getProblemId() {
  const lessonContent = document.querySelector('div.main > div.lesson-content, .lesson-content');
  return lessonContent?.getAttribute('data-lesson-id') || window.location.pathname.match(/lessons\/(\d+)/)?.[1] || '';
}

function getProblemLevel(problemId) {
  const lessonContent = document.querySelector('body > div.main > div.lesson-content, .lesson-content');
  return lessonContent?.getAttribute('data-challenge-level') || levels?.[problemId] || '0';
}

function getDivision() {
  const breadcrumb = document.querySelector('ol.breadcrumb');
  if (isNull(breadcrumb)) return '코딩테스트 연습';
  const items = [...breadcrumb.children]
    .filter((x) => !x.classList.contains('active'))
    .map((x) => x.innerText?.trim())
    .filter(Boolean)
    .map((x) => convertSingleCharToDoubleChar(x));
  return items.length > 0 ? items.join('/') : '코딩테스트 연습';
}

function getLanguageExtension() {
  const langText = textFromSelector(
    'div.editor > ul > li.nav-item.active > a, ' +
    'div.editor > ul > li.nav-item > a.active, ' +
    'div.editor > ul > li.nav-item > a, ' +
    '.editor .nav-item a'
  );
  const fileExtension = langText.match(/\.([A-Za-z0-9+#]+)\s*$/)?.[1];
  if (fileExtension) return fileExtension;

  const language = new URLSearchParams(window.location.search).get('language') || textFromSelector('div#tour7 > button, .language-select button');
  const languageMap = {
    c: 'c',
    cpp: 'cpp',
    csharp: 'cs',
    go: 'go',
    java: 'java',
    javascript: 'js',
    kotlin: 'kt',
    mysql: 'sql',
    oracle: 'sql',
    python: 'py',
    python3: 'py',
    ruby: 'rb',
    scala: 'scala',
    swift: 'swift',
  };
  return languageMap[language.toLowerCase()] || 'txt';
}

function getSubmittedCode() {
  const codeMirrorEl = document.querySelector('.CodeMirror');
  if (codeMirrorEl?.CodeMirror && typeof codeMirrorEl.CodeMirror.getValue === 'function') {
    return codeMirrorEl.CodeMirror.getValue();
  }

  const textarea = document.querySelector('textarea#code, textarea[name="code"], textarea[name*="code"]');
  if (!isNull(textarea) && !isEmpty(textarea.value)) return textarea.value;

  const fillBlankInputs = document.querySelectorAll('input[name^="input_code"], input[id^="input_code"]');
  if (fillBlankInputs.length > 0) {
    return reconstructFillBlankCode(fillBlankInputs[0].closest('pre, code, .markdown, .guide-section, div'));
  }

  return '';
}

async function parseData() {
  const link = getProblemLink();
  const problemId = getProblemId();
  const level = getProblemLevel(problemId);
  const division = getDivision();
  const title = textFromSelector('.algorithm-title .challenge-title, .challenge-title, h1');
  const problem_description = document.querySelector('div.guide-section-description > div.markdown, .guide-section-description .markdown')?.innerHTML || 'Empty';
  const language_extension = getLanguageExtension();
  const code = getSubmittedCode();
  const result_message =
    [...document.querySelectorAll('#output .console-message')]
      .map((node) => node.textContent)
      .filter((text) => text.includes(':'))
      .reduce((cur, next) => (cur ? `${cur}<br/>${next}` : next), '') || 'Empty';
  const [runtime, memory] = [...document.querySelectorAll('td.result.passed')]
    .map((x) => x.innerText)
    .map((x) => x.replace(/[^., 0-9a-zA-Z]/g, '').trim())
    .map((x) => x.split(', '))
    .reduce((x, y) => (Number(x[0].slice(0, -2)) > Number(y[0].slice(0, -2)) ? x : y), ['0.00ms', '0.0MB'])
    .map((x) => x.replace(/(?<=[0-9])(?=[A-Za-z])/, ' '));

  /*프로그래밍 언어별 폴더 정리 옵션을 위한 언어 값 가져오기*/
  const language = document.querySelector('div#tour7 > button').textContent.trim();

  return makeData({ link, problemId, level, title, problem_description, division, language_extension, code, result_message, runtime, memory, language });
}

async function makeData(origin) {
  const { link, problemId, level, language_extension, title, runtime, memory, code } = origin;
  const directory = getYYMMDD(new Date(Date.now()));
  const levelWithLv = `${level}`.includes('lv') ? level : `lv${level}`.replace('lv', 'level ');
  const message = link;
  const fileName = `[프로그래머스][${levelWithLv}] ${convertSingleCharToDoubleChar(title)}.${language_extension}`;
  return { problemId, directory, message, fileName, code };
}

function getYYMMDD(date) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}
