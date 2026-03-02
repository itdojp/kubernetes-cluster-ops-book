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
- 本書は「Kubernetes入門：PodからIngressまで（基礎と実践）」の理解を前提とします: [Kubernetes入門：PodからIngressまで（基礎と実践）](https://itdojp.github.io/kubernetes-basics-book/)
- コンテナ基礎は必要に応じて Podman 本を参照します: [Podman完全ガイド](https://itdojp.github.io/podman-book/)

## 学習成果
- クラスタの責任範囲（プラットフォーム/テナント）を明確化し、設計判断の前提を揃えられる
- 可用性、アップグレード、監視、障害対応を「標準化できる運用物」として定義できる
- 変更管理/復旧/セキュリティの観点で、運用の抜け漏れを減らせる

## 所要時間
- 通読: 約2.5〜3.5時間（本文量ベース概算。コードブロック除外、400〜600文字/分換算）
- 付録テンプレを自組織の Runbook/チェックリストへ落とし込む場合は、対象範囲により変動します。

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

- シリーズ共通ライセンス: https://github.com/itdojp/it-engineer-knowledge-architecture/blob/main/LICENSE.md
- 本リポジトリ内: https://github.com/itdojp/kubernetes-cluster-ops-book/blob/main/LICENSE.md
