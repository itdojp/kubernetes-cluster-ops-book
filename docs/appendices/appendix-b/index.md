---
layout: book
order: 16
title: "付録B：トラブルシュートフロー集"
---
# 付録B：トラブルシュートフロー集

本付録は、よくある障害を「症状→切り分け→暫定復旧→恒久対応」のフローとして整理します。  
最初は雛形として作成し、実運用の事例（ポストモーテム）から継続的に更新してください。

## 使い方
- まず影響範囲（顧客影響、データ影響、SLO）を確認し、Severity を確定します。
- 変更点（直近のデプロイ/設定変更/アップグレード）を最優先で確認します。
- 証跡（events/logs/メトリクス）を確保したうえで復旧操作を行います。

## フロー一覧（初期）
- API Server に到達できない
- Pod が Pending のまま
- CoreDNS が不安定（名前解決失敗）
- Node が NotReady になる
- etcd の容量不足/レイテンシ上昇
- イメージ pull 失敗（レジストリ/認証）
- Ingress 到達性障害（Controller/Service/DNS/TLS）
- ストレージ I/O の遅延/Volume Attach 失敗

## フロー雛形: API Server に到達できない

### 症状（例）
- `kubectl get nodes` がタイムアウトする
- API endpoint への疎通が取れない

### 切り分け（最小）
1) クライアント側（誤操作/誤接続）を除外します。
- context が正しいか（`kubectl config current-context`）
- kubeconfig の endpoint が意図したものか

2) ネットワーク到達性を確認します。
- VPN/プロキシ/Firewall の変更有無
- LB/エンドポイントへの疎通

3) プラットフォーム側の障害を確認します。
- マネージドの場合: プロバイダのステータス/イベント
- 自前運用の場合: Control Plane プロセス、証明書期限、etcd 健全性

### 暫定復旧（例）
- 影響範囲の切り分け（読み取り専用運用、変更凍結）
- API endpoint の復旧（LB/証明書/Control Plane の復旧）

### 恒久対応（例）
- 単一障害点の除去（Control Plane/etcd/LB）
- 監視指標とアラートの追加（到達性、レイテンシ、証明書期限）
- 復旧手順の Runbook 化と演習
