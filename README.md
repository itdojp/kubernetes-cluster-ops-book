# Kubernetesクラスタ設計・運用実践ガイド

Kubernetes クラスタの設計・運用（責任範囲、HA、アップグレード、監視、運用標準、障害対応）を中心に、実務観点で整理する。

## オンライン版
- [Kubernetesクラスタ設計・運用実践ガイド](https://itdojp.github.io/kubernetes-cluster-ops-book/)

## 対象読者
- Kubernetes クラスタの設計・運用に責任を持つインフラ/SRE/プラットフォームエンジニア

## 開発（ローカル）

### 前提
- Node.js（動作確認: v22）
- npm

### セットアップ
```bash
npm install
```

### src → docs 同期
```bash
npm run sync
```

### ビルド
```bash
npm run build
```

### 品質確認
`book-config.json` を正本として、npm パッケージ情報、Jekyll 設定、公開用 `docs/`、
ナビゲーション、`src/` との同期状態を確認します。

```bash
npm run check:metadata
npm test
```

### ローカルプレビュー
```bash
npm run dev
```

## フィードバック
- Issue: [itdojp/kubernetes-cluster-ops-book の Issues](https://github.com/itdojp/kubernetes-cluster-ops-book/issues)
- Email: [knowledge@itdo.jp](mailto:knowledge@itdo.jp)

## ライセンス
- CC-BY-NC-SA-4.0（商用利用は別途契約が必要）
- 詳細は `LICENSE.md` を参照
