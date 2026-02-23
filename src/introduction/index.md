# はじめに

本書「Kubernetesクラスタ設計・運用実践ガイド」は、Kubernetes クラスタの設計・運用における論点を、実務のチェック項目として再利用できる形で整理します。

## 本書の目的
- クラスタの責任範囲（プラットフォーム/テナント）を明確化し、設計判断の前提を揃える
- 可用性、アップグレード、監視、障害対応を「標準化できる運用物」として定義する
- 変更管理/復旧/セキュリティの観点で、運用の抜け漏れを減らす

## 前提（読者とスコープ）
- 前提読了: Kubernetes入門：PodからIngressまで（基礎と実践）: https://itdojp.github.io/kubernetes-basics-book/
- 本書はアプリ配置の手順書ではなく、クラスタ運用の設計・標準化に焦点を当てます
- コンテナ基礎は必要に応じて Podman 本を参照: https://itdojp.github.io/podman-book/

## 対象環境（動作確認/想定）
本書は特定ベンダに依存しませんが、議論の前提を揃えるため、以下を基準とします。

- Kubernetes: v1.35 系（2026-02-23 時点の stable は v1.35.1）
- ノードOS: Linux
- コンテナランタイム: containerd
- デプロイ形態:
  - マネージド Kubernetes（EKS/GKE/AKS 等）を第一想定
  - オンプレ/自前運用（kubeadm 等）は差分を補足として扱う

サポートポリシー（本書の前提）:
- 本書は v1.35 系を基準とし、minor バージョン差分が設計/運用に影響する場合は注記します。
- バージョン互換の考え方は、Kubernetes の Version Skew Policy を参照してください: https://kubernetes.io/releases/version-skew-policy/

## 参照方針
- 一次情報は Kubernetes/etcd の公式ドキュメントを優先します。
- 設計資料（KEP 等）は必要箇所で参照し、特定ベンダのブログに依存しないようにします。

## 付録のフォーマット
- 付録（チェックリスト/フロー）は Markdown のテンプレとして提供し、組織の運用物（Runbook 等）へ転記して運用します。

## 本書の使い方
- 章本文は「設計論点」と「実務チェック観点」を中心に読み進めてください。
- 実装を伴う手順は、組織の Runbook/Playbook に落とし込みます（付録のテンプレを利用します）。
- 監視/ログ/復旧の三点セットを、全章の共通軸として扱います。

## フィードバック
- Issue: https://github.com/itdojp/kubernetes-cluster-ops-book/issues
- Email: knowledge@itdo.jp

## 次に読む
- 第0章：前提とスコープ（責任範囲、用語、成果物の定義）
