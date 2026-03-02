/** 푼 문제들에 대한 단일 업로드는 uploadGit 함수로 합니다.
 * 파라미터는 아래와 같습니다.
 * @param {string} filePath - 업로드할 파일의 경로
 * @param {string} sourceCode - 업로드하는 소스코드 내용
 * @param {string} filename - 업로드할 파일명
 * @param {string} commitMessage - 커밋 메시지
 * @param {function} cb - 콜백 함수 (ex. 업로드 후 로딩 아이콘 처리 등)
 * @returns {Promise<void>}
 */
async function uploadOneSolveProblemOnGit(bojData, cb) {
  const token = await getToken();
  const hook = await getHook();
  if (isNull(token) || isNull(hook)) {
    console.error('token or hook is null', token, hook);
    return;
  }
  return upload(token, hook, bojData.code, bojData.directory, bojData.fileName, bojData.message, cb);
}

/** Github api를 사용하여 업로드를 합니다.
 * @see https://docs.github.com/en/rest/reference/repos#create-or-update-file-contents
 * @param {string} token - github api 토큰
 * @param {string} hook - github api hook
 * @param {string} sourceText - 업로드할 소스코드
 * @param {string} directory - 업로드할 파일의 경로
 * @param {string} filename - 업로드할 파일명
 * @param {string} commitMessage - 커밋 메시지
 * @param {function} cb - 콜백 함수 (ex. 업로드 후 로딩 아이콘 처리 등)
 */
async function upload(token, hook, sourceText, directory, filename, commitMessage, cb) {
  /* 업로드 후 커밋 */
  const git = new GitHub(hook, token);
  const stats = await getStats();
  const sourceSHA = calculateBlobSHA(sourceText);
  let default_branch = stats.branches[hook];
  if (isNull(default_branch)) {
    default_branch = await git.getDefaultBranchOnRepo();
    stats.branches[hook] = default_branch;
  }
  const { targetFilename, duplicated } = await getUploadTargetFilename(stats, hook, directory, filename, git, sourceSHA);
  if (duplicated) {
    if (typeof cb === 'function') {
      cb(stats.branches, directory);
    }
    return;
  }
  const { refSHA, ref } = await git.getReference(default_branch);
  const source = await git.createBlob(sourceText, `${directory}/${targetFilename}`); // 소스코드 파일
  const treeSHA = await git.createTree(refSHA, [source]);
  const commitSHA = await git.createCommit(commitMessage, treeSHA, refSHA);
  await git.updateHead(ref, commitSHA);

  /* stats의 값을 갱신합니다. */
  updateObjectDatafromPath(stats.submission, `${hook}/${source.path}`, source.sha);
  await saveStats(stats);
  // 콜백 함수 실행
  if (typeof cb === 'function') {
    cb(stats.branches, directory);
  }
}

async function getUploadTargetFilename(stats, hook, directory, filename, git, sourceSHA) {
  const dotIndex = filename.lastIndexOf('.');
  const hasExtension = dotIndex > 0;
  const baseName = hasExtension ? filename.slice(0, dotIndex) : filename;
  const extension = hasExtension ? filename.slice(dotIndex) : '';
  const remotePathSHA = new Map();
  const tree = await git.getTree().catch(() => []);
  if (Array.isArray(tree)) {
    tree.forEach((item) => {
      if (item?.type === 'blob' && item.path?.startsWith(`${directory}/`)) {
        remotePathSHA.set(item.path, item.sha);
      }
    });
  }
  let nextFileName = filename;
  let suffix = 2;

  while (true) {
    const path = `${directory}/${nextFileName}`;
    const cachedSHA = getObjectDatafromPath(stats.submission, `${hook}/${path}`);
    const existingSHA = cachedSHA || remotePathSHA.get(path);
    if (isNull(existingSHA)) {
      return { targetFilename: nextFileName, duplicated: false };
    }
    if (existingSHA === sourceSHA) {
      return { targetFilename: nextFileName, duplicated: true };
    }
    nextFileName = `${baseName}_${suffix}${extension}`;
    suffix += 1;
  }
}
