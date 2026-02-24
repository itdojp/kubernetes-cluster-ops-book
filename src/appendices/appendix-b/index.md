# 付録B：トラブルシュートフロー集

本付録は、よくある障害を「症状→切り分け→暫定復旧→恒久対応」のフローとして整理します。  
最初は雛形として作成し、実運用の事例（ポストモーテム）から継続的に更新してください。

## 使い方
- まず影響範囲（顧客影響、データ影響、SLO）を確認し、Severity を確定します。
- 変更点（直近のデプロイ/設定変更/アップグレード）を最優先で確認します。
- 証跡（events/logs/メトリクス）を確保したうえで復旧操作を行います。
- Events の表示順が期待どおりでない場合は、`--sort-by=.metadata.creationTimestamp` を試してください（環境により `.lastTimestamp` が期待どおりでない場合があります）。

## フロー一覧（初期） {#flow-index}
### Control Plane
- [API Server に到達できない](#flow-api-server)
- [etcd の容量不足/レイテンシ上昇](#flow-etcd)

### Scheduling / Capacity
- [Pod が Pending のまま](#flow-pod-pending)

### DNS / Network
- [CoreDNS が不安定（名前解決失敗）](#flow-coredns)

### Node
- [Node が NotReady になる](#flow-node-notready)

### Registry
- [イメージ pull 失敗（レジストリ/認証）](#flow-image-pull)

### Ingress
- [Ingress 到達性障害（Controller/Service/DNS/TLS）](#flow-ingress)

### Storage
- [ストレージ I/O の遅延/Volume Attach 失敗](#flow-storage)

## フロー雛形: API Server に到達できない {#flow-api-server}

### 症状（例）
- `kubectl get nodes` がタイムアウトする
- API endpoint への疎通が取れない

### 最小コマンドセット
```bash
kubectl config current-context
kubectl cluster-info
kubectl get nodes

# （環境により）/readyz の参照が許可されない場合があります
kubectl get --raw='/readyz?verbose'
```

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

### 関連章
- [第2章：コントロールプレーン設計](../../chapters/chapter02/)
- [第3章：etcd設計とバックアップ](../../chapters/chapter03/)
- [第9章：監視・ログ・アラート設計](../../chapters/chapter09/)
- [第11章：障害対応とトラブルシュート](../../chapters/chapter11/)

[↑ フロー一覧へ戻る](#flow-index)

## フロー雛形: Pod が Pending のまま {#flow-pod-pending}

### 症状（例）
- `kubectl -n <ns> get pod` で `Pending` が継続する
- `kubectl -n <ns> describe pod <name>` の Events に `FailedScheduling` が出る
- `Insufficient cpu/memory`、`node(s) had taint`、`0/.. nodes are available` などが出る

### 最小コマンドセット
```bash
kubectl -n <ns> get pod
kubectl -n <ns> describe pod <name>
kubectl -n <ns> get events --sort-by=.lastTimestamp
kubectl get nodes -o wide
```

### 切り分け（最小）
まず見る観測ポイント:
- Events: `kubectl -n <ns> describe pod <name>` / `kubectl -n <ns> get events --sort-by=.lastTimestamp`
- 変更履歴: 直近のマニフェスト変更、ノード増減、Quota 変更
- Node 状態: `kubectl get nodes` / `kubectl describe node <node>`

典型原因の当たりどころ:
1) リソース不足（キャパシティ）
- requests が大きすぎる、ノードが不足している、Pod 数上限に達している

2) スケジューリング制約
- `nodeSelector` / `nodeAffinity` / `podAffinity` / `topologySpreadConstraints`
- taint/toleration、（必要なら）PriorityClass/preemption

3) ストレージ待ち（PVC/StorageClass）
- PVC が `Pending`、または `WaitForFirstConsumer` により Pod 作成後に Binding される

4) テナント制約（運用標準）
- ResourceQuota/LimitRange、Namespace 標準（PSS/NetworkPolicy 等）により起動できない

### 暫定復旧（例）
- ノードを増やす（ノードプールのスケールアウト、欠損ノードの置換）
- requests/limits を下げる、または対象ワークロードのレプリカを調整する
- 制約（taint/affinity 等）を一時的に緩和して影響範囲を限定する
- PVC/StorageClass の問題を解消し、Binding を成立させる

### 恒久対応（例）
- キャパシティ計画（需要予測、ピーク時の余力、スケール手順）を整備する
- スケジューリング制約の標準（ノードプール分離、ラベル設計）をテンプレ化する
- Quota/LimitRange をテナント標準として定義し、例外を期限付きで管理する
- 監視（Pending 数、スケジューリング失敗率、容量逼迫）を追加する

### 関連章
- [第4章：ノード/ランタイム運用](../../chapters/chapter04/)
- [第6章：ストレージ設計と運用](../../chapters/chapter06/)
- [第8章：マルチテナントとリソース管理](../../chapters/chapter08/)
- [第9章：監視・ログ・アラート設計](../../chapters/chapter09/)

[↑ フロー一覧へ戻る](#flow-index)

## フロー雛形: CoreDNS が不安定（名前解決失敗） {#flow-coredns}

### 症状（例）
- Pod 内で `nslookup`/`dig` がタイムアウト、`SERVFAIL` になる
- Service 名（`<svc>.<ns>.svc.cluster.local`）の解決に失敗する
- CoreDNS Pod が再起動を繰り返す、または高負荷になる

### 最小コマンドセット
```bash
kubectl -n kube-system get pod -l k8s-app=kube-dns -o wide
kubectl -n kube-system logs deploy/coredns --tail=200
kubectl -n kube-system get events --sort-by=.lastTimestamp
```

### 切り分け（最小）
まず見る観測ポイント:
- Events/状態: `kubectl -n kube-system get pod -l k8s-app=kube-dns`
- ログ: `kubectl -n kube-system logs deploy/coredns`
- 変更履歴: CoreDNS ConfigMap（Corefile）、CNI/ネットワーク変更、ノード増減

典型原因の当たりどころ:
1) CoreDNS 自身の問題
- リソース不足、設定（Corefile）誤り、プラグイン設定の不整合

2) ネットワーク/到達性
- Pod ネットワーク（CNI）不調、kube-proxy/Service 到達性の問題
- upstream DNS への到達性（VPC/DNS/プロキシ）の問題

3) 依存先の問題
- 外部 DNS の障害やレート制限、名前解決の遅延

### 暫定復旧（例）
- CoreDNS のレプリカを増やす、リソースを引き上げる（急場の負荷対策）
- CoreDNS の再起動（原因究明前の影響限定。ただし証跡確保を優先）
- upstream DNS の経路/疎通を復旧する（ネットワーク設定のロールバック等）

### 恒久対応（例）
- CoreDNS の容量設計（QPS、キャッシュ、レプリカ、requests/limits）を標準化する
- 監視（失敗率/レイテンシ、欠測、Pod 再起動）と Runbook を整備する
- 変更管理（Corefile 変更のレビュー/検証）を強化する

### 関連章
- [第5章：ネットワーク設計と運用](../../chapters/chapter05/)
- [第4章：ノード/ランタイム運用](../../chapters/chapter04/)
- [第9章：監視・ログ・アラート設計](../../chapters/chapter09/)
- [第11章：障害対応とトラブルシュート](../../chapters/chapter11/)

[↑ フロー一覧へ戻る](#flow-index)

## フロー雛形: Node が NotReady になる {#flow-node-notready}

### 症状（例）
- `kubectl get nodes` で `NotReady` になる
- Node の `DiskPressure/MemoryPressure/PIDPressure` が発生する
- Pod が Evicted される、またはノード上のワークロードが不安定になる

### 最小コマンドセット
```bash
kubectl get nodes -o wide
kubectl describe node <node>
kubectl get events -A --sort-by=.lastTimestamp
```

### 切り分け（最小）
まず見る観測ポイント:
- Node 状態: `kubectl describe node <node>`
- Events: `kubectl get events -A --sort-by=.lastTimestamp`
- 変更履歴: OS パッチ、ノード入れ替え、ランタイム設定、CNI/CSI 変更

典型原因の当たりどころ:
1) OS/ランタイム要因
- 再起動、kubelet/ランタイム停止、ログ肥大化、イメージ肥大化、ディスク枯渇

2) ネットワーク要因
- ノード間通信、CNI 不調、MTU/経路変更、Firewall/SG 変更

3) リソース逼迫
- メモリ不足（OOM）、ディスク逼迫、PID 枯渇

### 暫定復旧（例）
- `cordon`/`drain` して影響を限定し、ノードを置換する
- ディスク/ログ/イメージを削減し、逼迫を緩和する（再発防止は別途）
- kubelet/ランタイムを再起動する（証跡確保のうえで）

### 恒久対応（例）
- ノード保守（ドレイン/置換）を標準化し、自動化（ノードプール運用）へ寄せる
- ログローテ/イメージ GC/ディスク監視を整備し、逼迫を予防する
- NotReady の検知（アラート）と一次対応 Runbook を整備する

### 関連章
- [第4章：ノード/ランタイム運用](../../chapters/chapter04/)
- [第9章：監視・ログ・アラート設計](../../chapters/chapter09/)
- [第11章：障害対応とトラブルシュート](../../chapters/chapter11/)

[↑ フロー一覧へ戻る](#flow-index)

## フロー雛形: etcd の容量不足/レイテンシ上昇 {#flow-etcd}

### 症状（例）
- API のタイムアウトや遅延が増える（`kubectl` が遅い/失敗する）
- etcd のアラーム（容量/レイテンシ）や警告が出る
- （自前運用の場合）etcd のディスク使用率が逼迫する

### 最小コマンドセット
```bash
# API 側の健全性（環境により権限/到達性が異なります）
kubectl get --raw='/readyz?verbose'

# 自前 Control Plane の場合（マネージドでは etcd Pod が見えないことがあります）
kubectl -n kube-system get pod -o wide
kubectl -n kube-system logs <etcd-pod> --tail=200
```

### 切り分け（最小）
まず見る観測ポイント:
- メトリクス: etcd の容量/レイテンシ、API Server のレイテンシ/エラー
- ログ: etcd / apiserver のログ（自前運用の場合）
- 変更履歴: 大量 apply、CRD/オブジェクト増、監査ログ設定変更、アップグレード

典型原因の当たりどころ:
1) 容量逼迫
- オブジェクト数増加、不要リソースの蓄積、コンパクション不足

2) 性能劣化
- ディスク I/O 劣化、フラグメンテーション、ネットワーク遅延

3) 負荷増大
- コントローラ/オペレータの過剰な更新、監査/イベントの増加

### 暫定復旧（例）
- 変更凍結（書き込み抑制）で影響を限定する
- 容量拡張（ディスク拡張）や性能回復（I/O のボトルネック解消）を実施する
- （自前運用の場合）安全を確認したうえでコンパクション/デフラグを実施する

### 恒久対応（例）
- バックアップ/リストア手順と演習を整備し、RTO/RPO と接続する
- etcd の監視（容量/レイテンシ/フラグメンテーション）とアラートを標準化する
- 大量変更の運用（バッチ、レート制御、検証環境）を整備する

### 関連章
- [第3章：etcd設計とバックアップ](../../chapters/chapter03/)
- [第2章：コントロールプレーン設計](../../chapters/chapter02/)
- [第9章：監視・ログ・アラート設計](../../chapters/chapter09/)
- [第10章：アップグレード戦略](../../chapters/chapter10/)

[↑ フロー一覧へ戻る](#flow-index)

## フロー雛形: イメージ pull 失敗（レジストリ/認証） {#flow-image-pull}

### 症状（例）
- Pod が `ImagePullBackOff` / `ErrImagePull` になる
- Events に `Unauthorized`、`pull access denied`、`TLS handshake timeout` が出る

### 最小コマンドセット
```bash
kubectl -n <ns> describe pod <name>
kubectl -n <ns> get events --sort-by=.lastTimestamp
kubectl -n <ns> get secret
kubectl get nodes -o wide
```

### 切り分け（最小）
まず見る観測ポイント:
- Events: `kubectl -n <ns> describe pod <name>`
- ノード状態: レジストリへの到達性、DNS、プロキシ設定
- 変更履歴: イメージ名/タグ変更、レジストリ移行、認証情報の更新

典型原因の当たりどころ:
1) 設定ミス
- イメージ名/タグ誤り、存在しないタグ、マニフェスト/アーキ不一致

2) 認証/認可
- imagePullSecret の誤り/期限切れ、権限不足、レート制限

3) ネットワーク
- DNS/プロキシ/Firewall、レジストリ障害、TLS 設定

### 暫定復旧（例）
- 直前の既知の良いイメージへロールバックする
- レジストリ到達性を復旧する（ネットワーク/認証の暫定修正）
- 影響範囲を限定する（デプロイ凍結、レプリカ調整）

### 恒久対応（例）
- レジストリと認証情報の運用（ローテーション、権限設計、期限）を標準化する
- タグ運用（latest 避け、イミュータブル参照）の方針を定める
- 監視（pull 失敗率、レジストリ到達性）と Runbook を整備する

### 関連章
- [第4章：ノード/ランタイム運用](../../chapters/chapter04/)
- [第12章：自動化と運用標準化](../../chapters/chapter12/)
- [第11章：障害対応とトラブルシュート](../../chapters/chapter11/)

[↑ フロー一覧へ戻る](#flow-index)

## フロー雛形: Ingress 到達性障害（Controller/Service/DNS/TLS） {#flow-ingress}

### 症状（例）
- 外部からの HTTP(S) が到達しない（タイムアウト、5xx、意図しない 404）
- TLS エラー（証明書不一致、期限切れ、SNI/Secret の不整合）が出る
- Ingress Controller の Pod/Service が不安定、または LB 側のヘルスチェックが落ちる

### 最小コマンドセット
```bash
kubectl -n <ns> get ingress
kubectl -n <ns> describe ingress <name>
kubectl -n <ns> get svc,endpointslice

# Ingress Controller の namespace は環境により異なります
kubectl -n ingress-nginx get pod,svc
```

### 切り分け（最小）
まず見る観測ポイント:
- 変更履歴: Ingress ルール/TLS 設定、Controller の更新、DNS/LB 設定変更
- コントローラ: `kubectl -n ingress-nginx get pod,svc`（環境により namespace は異なる）
- Ingress/Service/Endpoints: `kubectl -n <ns> describe ingress <name>` / `kubectl -n <ns> get endpointslice`

典型原因の当たりどころ（経路で分解）:
1) DNS/LB（外部公開）
- 名前解決、LB のターゲット/ヘルスチェック、セキュリティグループ/Firewall

2) Ingress Controller
- Controller Pod の障害、設定反映遅延、リソース不足

3) Service/Endpoints
- selector 不整合、バックエンド Pod 未 Ready、ポート不整合

4) TLS
- Secret 参照ミス、証明書期限、SNI/Host の不一致

### 暫定復旧（例）
- 影響範囲を限定する（対象ルートの切り戻し、既知の良い設定へロールバック）
- バックエンド疎通を直接確認し、問題の層を切り分ける（Service/Pod への到達確認）
- 証明書の暫定更新、または TLS を一時的に回避して復旧する（要件に応じて）

### 恒久対応（例）
- 外部公開の責任範囲（DNS/LB/証明書/変更手順）を明文化する
- 監視（5xx、レイテンシ、TLS エラー、Controller 健全性）と Runbook を整備する
- 変更管理（canary、検証、ロールバック）を標準化する

### 関連章
- [第5章：ネットワーク設計と運用](../../chapters/chapter05/)
- [第9章：監視・ログ・アラート設計](../../chapters/chapter09/)
- [第10章：アップグレード戦略](../../chapters/chapter10/)
- [第11章：障害対応とトラブルシュート](../../chapters/chapter11/)

[↑ フロー一覧へ戻る](#flow-index)

## フロー雛形: ストレージ I/O の遅延/Volume Attach 失敗 {#flow-storage}

### 症状（例）
- Pod が `ContainerCreating` から進まない（Volume Mount で待つ）
- Events に `FailedAttachVolume` / `FailedMount` / `Multi-Attach error` が出る
- アプリのレイテンシが悪化し、I/O 待ちが増える

### 最小コマンドセット
```bash
kubectl -n <ns> describe pod <name>
kubectl -n <ns> describe pvc <pvc>
kubectl get storageclass
```

### 切り分け（最小）
まず見る観測ポイント:
- Events: `kubectl -n <ns> describe pod <name>` / `kubectl -n <ns> describe pvc <pvc>`
- CSI: controller/node plugin のログ、Provision/Attach の失敗有無
- 変更履歴: StorageClass/CSI の更新、ノード入れ替え、ストレージ側メンテ

典型原因の当たりどころ:
1) Provision（PV 作成）
- StorageClass の設定、容量不足、権限、スナップショット/バックアップ影響

2) Attach/Mount
- ノード側の問題、アタッチ上限、Multi-Attach（RWO を複数ノードで使用）

3) 性能劣化（I/O）
- バックエンド劣化、I/O 枯渇、ノード側の I/O 競合

### 暫定復旧（例）
- 影響を限定する（対象ワークロードの停止/縮退、変更凍結）
- ボリュームの再アタッチ/再スケジュールで回避できるか確認する
- 代替ストレージクラス/別 AZ/別ノードプールへの退避を検討する

### 恒久対応（例）
- StorageClass の標準と利用ガイド（用途別、性能、暗号化、拡張）を整備する
- 監視（I/O レイテンシ、エラー、容量、Attach 失敗）と Runbook を整備する
- バックアップ/復旧（RTO/RPO）と演習を運用に組み込む

### 関連章
- [第6章：ストレージ設計と運用](../../chapters/chapter06/)
- [第4章：ノード/ランタイム運用](../../chapters/chapter04/)
- [第9章：監視・ログ・アラート設計](../../chapters/chapter09/)
- [第11章：障害対応とトラブルシュート](../../chapters/chapter11/)

[↑ フロー一覧へ戻る](#flow-index)
