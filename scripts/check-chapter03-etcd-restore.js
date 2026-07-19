#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function findRepoRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, 'book-config.json')) && fs.existsSync(path.join(current, 'package.json'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Repository root with book-config.json and package.json was not found.');
    }
    current = parent;
  }
}

const repoRoot = findRepoRoot(process.cwd());
const source = fs.readFileSync(path.join(repoRoot, 'src/chapters/chapter03/index.md'), 'utf8');
const generated = fs.readFileSync(path.join(repoRoot, 'docs/chapters/chapter03/index.md'), 'utf8');
const docsBody = generated.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
const errors = [];

function requireText(text, expected, label) {
  if (!text.includes(expected)) errors.push(`${label} is missing: ${expected}`);
}

function forbidText(text, forbidden, label) {
  if (text.includes(forbidden)) errors.push(`${label} contains forbidden text: ${forbidden}`);
}

if (docsBody !== source.trimStart()) {
  errors.push('src/chapters/chapter03/index.md and docs/chapters/chapter03/index.md are out of sync.');
}

[
  'kubeadm stacked etcd',
  '単一 Control Plane、単一local member',
  'HA stacked etcdはこの最小例の対象外',
  '同じsnapshotから全memberを復元',
  '新しいlogical cluster',
  '--bump-revision',
  '--mark-compacted',
  '/etc/kubernetes/manifests/etcd.yaml',
  '`etcd.yaml.bak`や`etcd.yaml.tmp`を同ディレクトリへ置いてはいけません',
  'atomic rename',
  'kubelet は `/etc/kubernetes/manifests` を監視',
  'static Pod を自動的に再作成',
  'crictl ps -a --name etcd',
  'API Server停止中は`kubectl`による確認が失敗し得る',
  'UIDと比較',
  'endpoint health',
  'endpoint status',
  'kubectl -n kube-system logs',
  'manifest 監視が働かない場合の fallback',
  '監視障害を診断',
  'systemctl restart kubelet` を fallback',
  '可用性リスク',
  'external etcd、マネージド Control Planeには適用せず',
].forEach((expected) => requireText(source, expected, 'chapter03 restore contract'));

forbidText(source, '`systemctl restart kubelet` で static Pod を再読込します。', 'chapter03 restore procedure');
forbidText(source, 'systemctl restart kubelet を必須', 'chapter03 restore procedure');
forbidText(source, '/etc/kubernetes/manifests/etcd.yaml.bak', 'chapter03 restore procedure');
forbidText(source, '/etc/kubernetes/manifests/etcd.yaml.tmp', 'chapter03 restore procedure');

if (errors.length > 0) {
  console.error('❌ Chapter 03 etcd restore regression check failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('✅ Chapter 03 etcd restore regression check passed');
