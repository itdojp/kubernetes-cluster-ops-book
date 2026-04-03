---
layout: book
order: 0
title: "Kubernetesクラスタ設計・運用実践ガイド"
permalink: /
---
# Kubernetesクラスタ設計・運用実践ガイド

Kubernetes クラスタの設計・運用（責任範囲、HA、アップグレード、監視、運用標準、障害対応）を中心に、実務観点で整理します。

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

## あとがき

- [あとがき](afterword/)

## ライセンス
本書は CC BY-NC-SA 4.0 で公開されています。商用利用は別途契約が必要です。
