---
layout: book
order: 18
title: "付録D：図表索引"
---
# 付録D：図表索引

本付録は、公開本文の第7章で実際に参照している PNG 図版だけを対象にします。図版は操作結果の例であり、対象クラスタ、Kubernetes バージョン、認証・認可設定によって出力は異なります。実環境での判断は、本文の手順と現在の設定・一次情報を併せて確認してください。

## 図表一覧

### 図7-1：RBAC の最小権限チェック（例） {#figure-index-ch07-rbac-can-i}

- **章**: [第7章：認証・認可と基本セキュリティ](../../chapters/chapter07/)
- **本文**: [図を開く](../../chapters/chapter07/#figure-ch07-rbac-can-i)
- **目的**: ServiceAccount に付与した Role と RoleBinding が、必要な `list pods` だけを許可する最小権限になっていることを確認する例です。
- **確認観点**: `kubectl auth can-i list pods` が `yes` になることに加え、許可していない操作が `no` になることを確認します。対象 namespace、ServiceAccount、API リソース、verb が意図した範囲に限定されているかを本文の RBAC 定義と照合してください。

### 図7-2：PSS の適用（例） {#figure-index-ch07-pss-namespace-label}

- **章**: [第7章：認証・認可と基本セキュリティ](../../chapters/chapter07/)
- **本文**: [図を開く](../../chapters/chapter07/#figure-ch07-pss-namespace-label)
- **目的**: tenant namespace に Pod Security Admission の `restricted` プロファイルを適用するラベル設定例を確認します。
- **確認観点**: `pod-security.kubernetes.io/enforce`、`warn` と各 `*-version` ラベルが対象 namespace に付与されていること、`--overwrite` による更新対象が意図どおりであることを確認します。例外 namespace は本文の方針どおり根拠・期限・代替策とともに管理してください。
