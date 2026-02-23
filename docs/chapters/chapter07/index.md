---
layout: book
order: 9
title: "第7章：認証・認可と基本セキュリティ"
---
# 第7章：認証・認可と基本セキュリティ

クラスタは「共有基盤」であるため、利用者・自動化・アドオンの権限境界が曖昧だと、障害時の影響が拡大し、監査にも耐えません。  
本章では、認証/認可（RBAC）と Pod Security（PSS）を中心に、最小権限を運用標準として定義するための論点を整理します。

## 学習目標
- 認証（Authentication）/認可（Authorization）/アドミッション（Admission）の役割分担を説明できる
- RBAC の標準（Role/ClusterRole、Binding、運用の棚卸し）を定義できる
- ServiceAccount の権限設計と、トークン取り扱いの注意点を整理できる
- Pod Security Standards（PSS）を用いて、ワークロードの最低限の制約を設計できる

## 扱う範囲 / 扱わない範囲

### 扱う範囲
- 人/自動化の認証方式の前提（kubeconfig、OIDC 等）の整理
- RBAC（Role/ClusterRole/Binding）の設計原則と運用（棚卸し、例外管理）
- ServiceAccount とワークロード権限（最小権限、トークンの扱い）
- Pod Security Admission による PSS 適用（namespace ラベル運用）
- 監査（Audit）と特権操作（break-glass）の統制

### 扱わない範囲
- IdP（SSO/MFA）や証明書基盤の実装手順の網羅
- コンテナイメージ供給網（SBOM/署名）やランタイム保護の深掘り

## セキュリティのレイヤ（最小）
- 認証（Authentication）: 「誰か」を識別する（例: OIDC、クライアント証明書、トークン）
- 認可（Authorization）: 「何ができるか」を決める（RBAC）
- アドミッション（Admission）: 「作ってよいか」を制約する（PSS、各種 Admission Policy）
- 監査（Audit）: 「何をしたか」を記録し追跡可能にする

## 認証（Authentication）の設計ポイント
- 人のアクセスは「共有アカウント」を避け、個人またはグループに紐付けます（監査/責任分界のため）。
- 自動化（CI/CD、運用ジョブ）は「目的別のID」を発行し、権限は最小化します。
- 長期固定のクレデンシャルは漏えいリスクが高いため、可能なら短命トークン/ローテーションを前提にします。

## 認可（Authorization）: RBAC の標準化
RBAC は「操作対象（resources）」と「操作内容（verbs）」を最小化し、例外を限定します。

- namespace 内の操作は `Role`/`RoleBinding` を基本とします（クラスタ全体の権限を避ける）。
- クラスタスコープのリソース（例: `nodes`, `namespaces`, `clusterroles`）は `ClusterRole` が必要であり、付与対象を厳格に制限します。
- 付与後は `kubectl auth can-i` で想定どおりに権限が絞れているか確認します。

最小例（namespace 内の Pod を読むだけの ServiceAccount）:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: demo-readonly
  namespace: tenant-a
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: tenant-a
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: bind-pod-reader
  namespace: tenant-a
subjects:
  - kind: ServiceAccount
    name: demo-readonly
    namespace: tenant-a
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: pod-reader
```

確認例:

```bash
kubectl -n tenant-a auth can-i list pods --as=system:serviceaccount:tenant-a:demo-readonly
```

## ServiceAccount とワークロード権限
- ワークロードに「デフォルト ServiceAccount のトークン」を自動マウントすると、不要な権限が配布されやすくなります。
- 権限が不要なワークロードは `automountServiceAccountToken: false` を標準にします。
- 権限が必要な場合は、目的別の ServiceAccount と最小 RBAC を作り、利用範囲（namespace/リソース/verbs）を限定します。

## Pod Security Standards（PSS）と Pod Security Admission
PSS は Pod の最低限のセキュリティ要件を「レベル（privileged/baseline/restricted）」として整理したものです。  
実装は Pod Security Admission を用い、namespace のラベルで適用します。

例（テナント namespace に restricted を強制し、Kubernetes v1.35 のポリシーに固定）:

```bash
kubectl label ns tenant-a \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/enforce-version=v1.35 \
  pod-security.kubernetes.io/warn=restricted \
  pod-security.kubernetes.io/warn-version=v1.35 \
  --overwrite
```

運用上の要点:
- `kube-system` 等のシステム系 namespace は例外が必要になり得ます。例外は「専用 namespace に分離」「期限/根拠」「代替策（監査/隔離）」をセットで管理します。
- アップグレード時に PSS のバージョン更新が必要になるため、変更管理（第10章）に組み込みます。

## 監査（Audit）と特権操作（break-glass）
- 監査ログは「誰が」「何を」「いつ」行ったかの一次情報です。収集/保管/閲覧権限を標準化します。
- 障害対応や緊急作業のために「break-glass（特権）」が必要な場合は、利用条件、承認、証跡、事後レビューを運用手順に含めます。

## 実務チェック観点（最低5項目）
- 人/自動化のID体系（SSO、グループ、CI/CD用ID）が定義され、共有クレデンシャルを排除している
- `cluster-admin` 付与の基準と棚卸し（期限、根拠、レビュー頻度）が運用されている
- namespace 標準（RBAC、PSS、必要なら NetworkPolicy/Quota）がテンプレ化され、払い出しに組み込まれている
- ServiceAccount の権限は目的別に最小化され、不要なトークン自動マウントを抑止している
- 監査ログの収集/保管/検索性と、閲覧権限（PII/機密を含み得る）が定義されている

## よくある落とし穴
- 便宜上 `cluster-admin` を広く配布し、監査・責任分界・事故時の封じ込めが破綻する
- PSS を一括で厳格化し、例外管理が不十分なまま回避策（別クラスタ/無制限 namespace）を増やしてしまう

## まとめ / 次に読む
- 次に読む: 第8章：マルチテナントとリソース管理（/chapters/chapter08/）
