# 付録D：図表索引

本付録は、公開本文で実際に参照している14点のP0 visual evidenceだけを対象にします。各図版は2026-07-23（JST）に隔離したdisposable kind環境または同一capture run内の検証fixtureから取得した実行結果であり、合成したoperational stateではありません。対象クラスタ、Kubernetes version、認証・認可設定により出力は異なるため、実環境では本文の判断手順と現在の一次情報を併せて確認してください。

正本inventory、capture provenance、sanitization項目、source command、hashは [`src/assets/visual-evidence/manifest.json`](https://github.com/itdojp/kubernetes-cluster-ops-book/blob/main/src/assets/visual-evidence/manifest.json) で管理します。

## 図表一覧

## 第0章：前提とスコープ

### 図D-01：変更ID・責任者・rollback・検証証跡の記録完全性を判断するchange record検証結果 {#figure-index-ch00-change-record-gate-01}

- **章**: [第0章：前提とスコープ](../../chapters/chapter00/)
- **本文**: [図を開く](../../chapters/chapter00/#figure-ch00-change-record-gate-01)
- **ファイル**: `ch00-change-record-gate-01.png`
- **目的**: 変更作業へ入る前に、責任者・切り戻し・検証・証跡の必須項目がそろっていることを確認します。
- **確認の観点**: jqの真偽値とCHANGE_RECORD_GATE=PASSを見て、changeId、ownerRole、rollback、verification、evidenceが欠けていないかを確認します。

## 第1章：クラスタ設計の全体像

### 図D-02：API endpoint・node version・runtime・CRD・基盤Deploymentの棚卸し結果を判断する出力 {#figure-index-ch01-cluster-inventory-01}

- **章**: [第1章：クラスタ設計の全体像](../../chapters/chapter01/)
- **本文**: [図を開く](../../chapters/chapter01/#figure-ch01-cluster-inventory-01)
- **ファイル**: `ch01-cluster-inventory-01.png`
- **目的**: 設計や変更計画の入力になるクラスタ構成と基盤ワークロードの現状を取得します。
- **確認の観点**: API到達先、nodeのKubernetes/runtime version、CRD数、CoreDNSのREADYとDESIREDが同じ時点の記録になっているかを確認します。

## 第2章：コントロールプレーン設計

### 図D-03：readyz各checkとcontrol plane PodのReady・restart状態を判断する出力 {#figure-index-ch02-control-plane-readyz-01}

- **章**: [第2章：コントロールプレーン設計](../../chapters/chapter02/)
- **本文**: [図を開く](../../chapters/chapter02/#figure-ch02-control-plane-readyz-01)
- **ファイル**: `ch02-control-plane-readyz-01.png`
- **目的**: APIが応答するだけでなく、依存checkとcontrol plane componentがそろって健全であることを確認します。
- **確認の観点**: readyz check passed、各PodのREADY=true、RESTARTS=0を見て、異常時は失敗したcheckまたはcomponentへ切り分けます。

## 第3章：etcd設計とバックアップ

### 図D-04：etcd snapshotの保存・server version・hash・revision・sizeを判断する出力 {#figure-index-ch03-etcd-snapshot-status-01}

- **章**: [第3章：etcd設計とバックアップ](../../chapters/chapter03/)
- **本文**: [図を開く](../../chapters/chapter03/#figure-ch03-etcd-snapshot-status-01)
- **ファイル**: `ch03-etcd-snapshot-status-01.png`
- **目的**: snapshotコマンドの終了だけでなく、etcdutlで読める一貫した成果物が生成されたことを確認します。
- **確認の観点**: Snapshot saved、Server version、status表、SNAPSHOT_STATUS_GATE=PASSを照合し、revision・key数・sizeを復旧記録へ残します。

## 第4章：ノード/ランタイム運用

### 図D-05：Node Ready・各Pressure condition・allocatable resourceを判断する出力 {#figure-index-ch04-node-conditions-01}

- **章**: [第4章：ノード/ランタイム運用](../../chapters/chapter04/)
- **本文**: [図を開く](../../chapters/chapter04/#figure-ch04-node-conditions-01)
- **ファイル**: `ch04-node-conditions-01.png`
- **目的**: node保守前に、稼働状態とresource余力を同時に確認します。
- **確認の観点**: READY=True、各PRESSURE=Falseを確認し、allocatable値をworkload退避・再配置の前提と照合します。

## 第5章：ネットワーク設計と運用

### 図D-06：CoreDNS・Service・EndpointSlice・名前解決・HTTP到達性を判断する出力 {#figure-index-ch05-dns-service-check-01}

- **章**: [第5章：ネットワーク設計と運用](../../chapters/chapter05/)
- **本文**: [図を開く](../../chapters/chapter05/#figure-ch05-dns-service-check-01)
- **ファイル**: `ch05-dns-service-check-01.png`
- **目的**: アプリ不調をDNS、Service selector、Endpoint、HTTPの層に分けて切り分けます。
- **確認の観点**: CoreDNSのReady、ServiceとEndpointSliceの対応、nslookupの応答、HTTP_SERVICE_OKを順に確認します。

## 第6章：ストレージ設計と運用

### 図D-07：provisioner checksum・StorageClass・PVC Bound・mount後readを判断する出力 {#figure-index-ch06-storage-pvc-check-01}

- **章**: [第6章：ストレージ設計と運用](../../chapters/chapter06/)
- **本文**: [図を開く](../../chapters/chapter06/#figure-ch06-storage-pvc-check-01)
- **ファイル**: `ch06-storage-pvc-check-01.png`
- **目的**: StorageClass選択からPVCのbind、Podからのreadまでを一つの証跡として確認します。
- **確認の観点**: manifest checksum OK、PVC STATUS=Bound、mount先のverifiedを照合し、provisionerと利用側の両方を確認します。

## 第7章：認証・認可と基本セキュリティ

### 図D-08：ServiceAccountの許可操作と拒否操作からRBAC最小権限を判断する出力 {#figure-index-ch07-rbac-can-i}

- **章**: [第7章：認証・認可と基本セキュリティ](../../chapters/chapter07/)
- **本文**: [図を開く](../../chapters/chapter07/#figure-ch07-rbac-can-i)
- **ファイル**: `ch07-rbac-can-i-01.png`
- **目的**: 許可したverbだけでなく、許可していない操作が拒否されることまで確認します。
- **確認の観点**: list pods=yes、delete deployments=no、DENY_GATE=PASSとRoleBindingの参照先を本文のRBAC定義と照合します。

### 図D-09：namespaceのPSS enforce・warn・version label適用状態を判断する出力 {#figure-index-ch07-pss-namespace-label}

- **章**: [第7章：認証・認可と基本セキュリティ](../../chapters/chapter07/)
- **本文**: [図を開く](../../chapters/chapter07/#figure-ch07-pss-namespace-label)
- **ファイル**: `ch07-pss-namespace-label-02.png`
- **目的**: Pod Security Admissionのprofileとversion pinが対象namespaceへ反映されたことを確認します。
- **確認の観点**: enforce、warn、enforce-version、warn-versionの4 labelと値を確認し、例外namespaceの扱いは別の運用記録で管理します。

## 第8章：マルチテナントとリソース管理

### 図D-10：ResourceQuota・LimitRangeとadmission後の既定resource値を判断する出力 {#figure-index-ch08-quota-limitrange-01}

- **章**: [第8章：マルチテナントとリソース管理](../../chapters/chapter08/)
- **本文**: [図を開く](../../chapters/chapter08/#figure-ch08-quota-limitrange-01)
- **ファイル**: `ch08-quota-limitrange-01.png`
- **目的**: quotaの上限だけでなく、resource未指定PodへLimitRange既定値が実際に注入されることを確認します。
- **確認の観点**: quota hard値とdry-run後のrequests/limitsを照合し、defaultRequestとdefaultが運用標準どおりかを確認します。

## 第9章：監視・ログ・アラート設計

### 図D-11：API server inflight requestとworkqueue depthの取得可否を判断する出力 {#figure-index-ch09-apiserver-metrics-01}

- **章**: [第9章：監視・ログ・アラート設計](../../chapters/chapter09/)
- **本文**: [図を開く](../../chapters/chapter09/#figure-ch09-apiserver-metrics-01)
- **ファイル**: `ch09-apiserver-metrics-01.png`
- **目的**: 監視製品に依存せず、control planeの飽和・queue観測に必要なmetricが取得できることを確認します。
- **確認の観点**: mutating/readOnly inflight値、複数controllerのworkqueue_depth、PASS markerを見て、0値と欠測を区別します。

## 第10章：アップグレード戦略

### 図D-12：kubectl・API server・kubeadm・kubelet・runtimeのversion skewを判断する出力 {#figure-index-ch10-version-skew-inventory-01}

- **章**: [第10章：アップグレード戦略](../../chapters/chapter10/)
- **本文**: [図を開く](../../chapters/chapter10/#figure-ch10-version-skew-inventory-01)
- **ファイル**: `ch10-version-skew-inventory-01.png`
- **目的**: upgrade計画前にclient、control plane、node、runtimeのversionを同一時点で棚卸しします。
- **確認の観点**: Client/Server、kubeadm、KUBELET、RUNTIMEの値を公式version skew policyと照合し、更新順序を決めます。

## 第11章：障害対応とトラブルシュート

### 図D-13：Service selector誤設定によるEndpoint消失と復旧を判断する出力 {#figure-index-ch11-service-recovery-01}

- **章**: [第11章：障害対応とトラブルシュート](../../chapters/chapter11/)
- **本文**: [図を開く](../../chapters/chapter11/#figure-ch11-service-recovery-01)
- **ファイル**: `ch11-service-recovery-01.png`
- **目的**: 変更点を一つに限定し、障害の再現と復旧確認を同じEndpointSliceで追跡します。
- **確認の観点**: 変更前のEndpoint、誤selector時のunset、復元後のEndpoint、PASS markerを時系列で確認します。

## 第12章：自動化と運用標準化

### 図D-14：PSS違反manifestの拒否と準拠manifestのserver dry-run成功を判断する出力 {#figure-index-ch12-policy-gate-01}

- **章**: [第12章：自動化と運用標準化](../../chapters/chapter12/)
- **本文**: [図を開く](../../chapters/chapter12/#figure-ch12-policy-gate-01)
- **ファイル**: `ch12-policy-gate-01.png`
- **目的**: Policy as Codeの価値を、違反の拒否と準拠manifestの受理の両方で確認します。
- **確認の観点**: Forbidden理由、POLICY_GATE_REJECTED_AS_EXPECTED、compliant Podのserver dry-run、COMPLIANT_MANIFEST_GATE=PASSを確認します。
