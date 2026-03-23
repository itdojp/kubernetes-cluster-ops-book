# 第3章：etcd設計とバックアップ

etcd は Kubernetes のクラスタ状態を保持する基盤であり、障害時の復旧性と性能に直結します。本章では、トポロジ選択とバックアップ/リストアの運用観点を整理します。

## 学習目標
- etcd の役割と、障害時に起きる影響を説明できる
- トポロジ（stacked / external）選択の論点を整理できる
- バックアップ/リストアを運用物として定義し、演習計画を立てられる

## 扱う範囲 / 扱わない範囲

### 扱う範囲
- etcd の役割（状態保存、整合性）
- トポロジの選択（stacked / external）
- バックアップ（snapshot）とリストアの考え方
- 運用指標（容量、レイテンシ）とアラート

### 扱わない範囲
- etcd の詳細なチューニングパラメータの網羅
- すべての障害シナリオ

## 定義（この章の用語）
- snapshot: etcd の特定時点の状態を保存したもの（バックアップの代表的な手段）
- RPO/RTO: 目標復旧時点/目標復旧時間。バックアップ頻度と復旧手順の要件になります。

## 背景（なぜ重要か）
- etcd が劣化すると API 全体が遅くなり、障害対応や運用作業が進まなくなります。
- 「バックアップがある」だけでは不足で、復旧できること（リストア演習と所要時間の把握）が必要です。

## etcd が持つもの
- Kubernetes API オブジェクト（metadata/spec など）
- 状態変更の履歴（watch 等に影響）

注意:
- 大きすぎるオブジェクトや高頻度の書き込みは、etcd に負荷をかけます。

## トポロジ選択（概略）

### stacked etcd
- Control Plane ノード上で etcd を動かします。
- 構成が単純ですが、障害ドメインが近くなります。

### external etcd
- etcd クラスタを Control Plane と分離します。
- 障害分離はできますが、運用対象が増えます（監視、バックアップ、証明書等）。

## 手順/例：バックアップ/リストア運用の型
1. RPO/RTO を前提に、バックアップ頻度と保持期間を決める
2. バックアップの取得（自動化）と成功判定（監視/アラート）を用意する
3. 保管先を分離し、暗号化とアクセス権を標準化する（単一障害点を避ける）
4. リストア手順を Runbook 化し、検証環境で定期的に演習して所要時間を記録する

## バックアップ/リストア（運用観点）
- バックアップの頻度（RPO）と保持期間
- 取得方法（スナップショット、暗号化、保管先）
- リストア手順（検証環境での演習）
- 復旧手順とエスカレーション

### 最小実行例（kubeadm 管理の static Pod を前提）
前提:
- ローカル etcd を使う Control Plane ノードで実行する
- endpoint は `https://127.0.0.1:2379`、証明書は kubeadm 既定の `/etc/kubernetes/pki/etcd/` を使う
- 本番 restore は API Server 停止計画とセットで扱い、まず検証環境で演習する

```bash
export ETCDCTL_API=3

etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  snapshot save /var/backups/etcd/snapshot.db

etcdutl snapshot status /var/backups/etcd/snapshot.db -w table

etcdutl \
  snapshot restore /var/backups/etcd/snapshot.db \
  --data-dir /var/lib/etcd-from-backup
```

restore 後の最小反映:
1. `/etc/kubernetes/manifests/etcd.yaml` の `name: etcd-data` に対応する `hostPath.path` を `/var/lib/etcd-from-backup` に差し替えます。
2. `systemctl restart kubelet` で static Pod を再読込します。
3. API Server / Controller Manager / Scheduler の再起動要否を runbook に含めます。

## 注意点（運用）
- リストアはクラスタ停止を伴う場合があります。実施条件、影響範囲、判断責任者を事前に定義してください（要確認）。
- バックアップの保管先（オブジェクトストレージ等）も障害します。可用性とアクセス制御を設計に含めます。
- トポロジ（stacked / external）の選択は、障害分離と運用負荷のトレードオフです。組織の運用体制に合わせて決めます。

注意:
- `etcdctl snapshot restore` は etcd v3.5 で非推奨、v3.6 で削除済みのため、restore/status は `etcdutl` 前提で記述します。
- external etcd やマネージド Control Plane では、証明書パスと再起動手順が異なるため、各製品の手順に読み替えます。

## 実務チェック観点（最低5項目）
- RPO/RTO とバックアップ頻度が整合している
- バックアップの保管先が単一障害点になっていない
- リストア演習が定期的に実施され、所要時間が記録されている
- etcd の容量/レイテンシに基づくアラートがある
- バージョンアップ時の互換性と手順が定義されている

## よくある落とし穴
- バックアップは取っているが、リストア手順がない/演習がない
- etcd 容量の監視がなく、上限に近づいてから気付く

## まとめ / 次に読む
- 次に読む: [第4章：ノード/ランタイム運用](../chapter04/)
