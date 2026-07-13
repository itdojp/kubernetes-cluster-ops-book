---
layout: book
order: 0
title: "Kubernetesクラスタ設計・運用実践ガイド"
description: "Kubernetes クラスタの設計・運用（責任範囲、HA、アップグレード、監視、運用標準、障害対応）を中心に、実務観点で整理する。"
author: "株式会社アイティードゥ"
version: "1.0.0"
permalink: /
---
# Kubernetesクラスタ設計・運用実践ガイド

Kubernetes クラスタの設計・運用（責任範囲、HA、アップグレード、監視、運用標準、障害対応）を中心に、実務観点で整理する。

## 想定読者
- Kubernetes クラスタの設計・運用に責任を持つインフラ/SRE/プラットフォームエンジニア
- 可用性、アップグレード、監視、障害対応の標準化を進めたい方

## 前提
- 本書は [Kubernetes入門：PodからIngressまで（基礎と実践）](https://itdojp.github.io/kubernetes-basics-book/) の理解を前提とします
- コンテナ基礎は必要に応じて [Podman完全ガイド](https://itdojp.github.io/podman-book/) を参照してください

## 学習成果
- クラスタ設計（可用性、アップグレード、ネットワーク、ストレージ）の主要論点を説明できる
- 運用標準（監視/ログ、変更管理、障害対応、チェックリスト）を整備し、運用品質を安定化できる
- 運用の制約（責任分界、セキュリティ、SLO/運用体制）を前提として、手戻りの少ない判断ができる

## 実務適用前の Kubernetes クラスタ運用レビューゲート
本書のチェックリストや Runbook 雛形を本番クラスタへ適用する前に、次の観点を必ず確認してください。

- 2026-05-23（Asia/Tokyo）時点の Kubernetes 公式リリース情報では、最新系列は v1.36、サポート対象 minor は v1.36 / v1.35 / v1.34 です。既存の v1.35 前提はまだサポート対象ですが、新規設計・アップグレード計画では公式リリース情報を再確認します。
- Control Plane、kubelet、kube-proxy、kubectl、CNI/CSI/CoreDNS/Ingress Controller、監視/ログ基盤、CRD/Webhook の実バージョンと責任範囲を棚卸しします。
- Version Skew Policy を一次情報で確認し、HA Control Plane、ノード、クライアント、アドオンの許容差分を運用計画に落とし込みます。
- etcd / 永続データ / 設定リポジトリのバックアップ成功だけでなく、隔離環境でのリストア演習、RPO/RTO、暗号化、アクセス権を確認します。
- 変更管理では、SLO 影響、メンテナンス時間、canary 範囲、中断条件、ロールバック不可時の代替復旧手段、証跡保存を事前に合意します。

## 所要時間
- 通読: 約3〜4時間（本文量ベース概算。コードブロック除外、400〜600文字/分換算）
- 付録のチェックリスト/フローを運用へ取り込む場合は、既存の運用体制や検討範囲により変動します。

## 利用と更新情報
- リポジトリ: [GitHub](https://github.com/itdojp/kubernetes-cluster-ops-book)
- 更新差分を追う場合は、GitHub の [コミット履歴](https://github.com/itdojp/kubernetes-cluster-ops-book/commits/main/) と [PR 一覧](https://github.com/itdojp/kubernetes-cluster-ops-book/pulls) を参照してください。
- 本書の本文・付録は `src/` を編集起点に更新し、`npm run build` で `docs/` を再生成します。
- 変更を公開へ反映する前に、対象クラスタのバージョンと公式ドキュメントを確認してください。

## 目次
- [はじめに](introduction/)

## 本編

- [第0章：前提とスコープ](chapters/chapter00/)
- [第1章：クラスタ設計の全体像](chapters/chapter01/)
- [第2章：コントロールプレーン設計](chapters/chapter02/)
- [第3章：etcd設計とバックアップ](chapters/chapter03/)
- [第4章：ノード/ランタイム運用](chapters/chapter04/)
- [第5章：ネットワーク設計と運用](chapters/chapter05/)
- [第6章：ストレージ設計と運用](chapters/chapter06/)
- [第7章：認証・認可と基本セキュリティ](chapters/chapter07/)
- [第8章：マルチテナントとリソース管理](chapters/chapter08/)
- [第9章：監視・ログ・アラート設計](chapters/chapter09/)
- [第10章：アップグレード戦略](chapters/chapter10/)
- [第11章：障害対応とトラブルシュート](chapters/chapter11/)
- [第12章：自動化と運用標準化](chapters/chapter12/)

## 付録

- [付録A：運用チェックリストPack](appendices/appendix-a/)
- [付録B：トラブルシュートフロー集](appendices/appendix-b/)
- [付録C：参考リンク集](appendices/appendix-c/)
- [付録D：図表索引](appendices/appendix-d/)

## あとがき

- [あとがき](afterword/)

## ライセンス
本書は CC BY-NC-SA 4.0 で公開されています。商用利用は別途契約が必要です。
