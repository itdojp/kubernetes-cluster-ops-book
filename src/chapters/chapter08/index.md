# 第8章：マルチテナントとリソース管理

クラスタ利用者（チーム/プロダクト）が増えると、障害の影響範囲とコストが増大します。  
本章では、マルチテナントの境界（Namespace/RBAC）と、リソースのフェアユース（Quota/LimitRange/Priority）を運用標準として整備するための論点を整理します。

## 学習目標
- マルチテナントモデル（クラスタ分離/namespace 分離/ノード分離）の選定観点を説明できる
- namespace 標準（払い出しテンプレ）を定義できる
- ResourceQuota と LimitRange を用いて、リソース消費の上限と既定値を制御できる
- PriorityClass の設計と運用上の注意点（preemption、重要度の乱用）を整理できる

## 扱う範囲 / 扱わない範囲

### 扱う範囲
- テナントの境界設計（クラスタ/namespace/ノードプール）
- namespace 標準（RBAC、PSS、必要なら NetworkPolicy/Quota 等）のテンプレ化
- ResourceQuota / LimitRange / PriorityClass の基本と運用
- キャパシティ管理（過剰割当、枯渇）とコスト可視化の論点

### 扱わない範囲
- 階層型クォータ等の高度な仕組みの網羅（製品/実装に依存するため）
- FinOps ツールの導入手順の詳細

## マルチテナントモデル（境界の選び方）
要件（隔離、規制、コスト、運用体制）により、境界の強度を選択します。

- 強い隔離: クラスタを分離（テナントごと/環境ごと）
- 中程度: 同一クラスタで namespace を分離（RBAC/ポリシー/クォータで統制）
- 補助線: ノードプール分離（taint/toleration、ラベル）で実行基盤を分ける

「強い隔離」が必要な場合、namespace だけで担保しようとすると例外が増え、結果的に運用負債になります。

## namespace 標準（払い出しテンプレ）
テナント namespace には、最低限以下をセットで適用するのが実務的です。

- RBAC（第7章）: 権限の最小化、管理者と閲覧者の分離
- Pod Security（PSS）: `restricted` を基本とし、例外は明示的に管理
- ResourceQuota: 上限の明確化（CPU/メモリ/Pod数 等）
- LimitRange: 既定の requests/limits（過剰割当と BestEffort の抑止）
- （必要なら）NetworkPolicy: 通信の既定拒否/許可の方針

## ResourceQuota（上限の制御）
ResourceQuota は namespace 単位で「消費の上限」を宣言し、リソース枯渇の影響範囲（blast radius）を限定します。

最小例:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-a-quota
  namespace: tenant-a
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "50"
```

運用上の要点:
- 上限の根拠（SLO、想定負荷、課金/予算）を残します。
- 「例外的に上げた」クォータは棚卸し（期限/レビュー）対象にします。

## LimitRange（既定値とガードレール）
LimitRange は requests/limits の既定値や最小/最大を制約し、運用のばらつきを減らします。

最小例（既定の requests/limits を付与）:

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: tenant-a-defaults
  namespace: tenant-a
spec:
  limits:
    - type: Container
      defaultRequest:
        cpu: 100m
        memory: 256Mi
      default:
        cpu: 500m
        memory: 512Mi
```

## PriorityClass（重要度とプリエンプション）
PriorityClass は、スケジューリングの優先度と、必要に応じた preemption（低優先度の追い出し）に関わります。  
重要度の設計が崩れると、クラスタ全体の安定性に影響します。

最小例:

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: tenant-critical
value: 100000
preemptionPolicy: PreemptLowerPriority
globalDefault: false
description: "Tenant critical workloads"
```

運用上の要点:
- 「誰が」「どの条件で」高優先度を使えるかを統制します（申請/承認/期限）。
- preemption は復旧には有効ですが、誤用すると別テナントの障害を誘発します。

## 実務チェック観点（最低5項目）
- テナント境界（クラスタ/namespace/ノードプール）の選定根拠が要件に紐付いている
- namespace 払い出しがテンプレ化され、RBAC/PSS/Quota/LimitRange が自動適用される
- ResourceQuota の上限が形骸化しておらず、例外は期限付きで管理されている
- LimitRange により requests/limits の既定値が与えられ、BestEffort の濫用を抑止できている
- PriorityClass の設計が統制され、重要度の乱用と preemption の副作用を管理できている

## よくある落とし穴
- Quota/LimitRange を入れずに運用を開始し、リソース枯渇がクラスタ全体の障害に波及する
- PriorityClass を場当たり的に追加し、復旧時に「どれが重要か」が判断できなくなる

## まとめ / 次に読む
- 次に読む: [第9章：監視・ログ・アラート設計](../chapter09/)
