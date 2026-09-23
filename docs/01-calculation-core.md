# 첫 번째 작업 기록: 금융 계산 코어와 단위 테스트

## 작업 개요

- 작업일: 2026년 9월 23일
- 단계: 3일 MVP 중 1일 차 핵심 작업
- 목표: UI 개발 전에 월급 배분과 세금 비교 규칙을 순수 함수와 테스트로 고정
- 결과: 단위 테스트 25개, ESLint, 프로덕션 빌드 통과

이 단계에서는 화면을 먼저 만들지 않았습니다. 금융 서비스의 핵심인 계산 결과가 입력과 가정에 따라 일관되게 재현되도록 도메인 로직을 먼저 분리했습니다.

## 작업 전 확정한 정책

### 1. React 정적 MVP

계산은 브라우저 안에서 수행합니다. 로그인, 데이터베이스, 실제 계좌 연동, Spring Boot API는 첫 MVP에 포함하지 않습니다.

### 2. 비상금과 ISA 병행 배정

비상금이 부족하다고 해서 월 가용액 전부를 CMA에 넣지는 않습니다. 비상금 부족액을 12개월로 나눈 금액을 우선 배정하고, 남는 금액은 ISA에 배정합니다.

```text
월 가용액 = max(월 실수령액 - 월 필수지출, 0)
비상금 목표 = 월 필수지출 × 3
비상금 부족액 = max(비상금 목표 - 현재 비상금, 0)
월 CMA 필요액 = ceil(비상금 부족액 ÷ 12)
월 CMA 배정액 = min(월 가용액, 월 CMA 필요액)
월 ISA 배정액 = 월 가용액 - 월 CMA 배정액
```

비상금 부족액을 12로 나눌 때에는 목표를 미달하지 않도록 원 단위로 올림합니다.

### 3. ISA 유형 미선택

사용자가 ISA 유형을 모르거나 선택하지 않은 경우 일반형으로 계산합니다. 서민형으로 잘못 가정해 절세액을 과장하지 않기 위한 보수적 기본값입니다.

계산 결과에는 `ISA_TYPE_DEFAULTED` 경고를 포함해 UI에서 임시 계산임을 알릴 수 있게 했습니다.

### 4. 실제 ISA 잔여 한도

MVP는 올해 이미 납입한 ISA 금액을 입력받지 않습니다. 따라서 실제 잔여 한도를 자동 계산하거나 추천 금액을 강제로 잘라내지 않습니다.

월 ISA 배정액의 12배가 기본 연간 납입한도를 넘으면 `ISA_ANNUAL_LIMIT_EXCEEDED` 경고를 반환합니다. 미사용 한도 이월과 실제 잔여 한도는 금융회사에서 확인해야 합니다.

### 5. 세금 비교 대상

일반계좌와 ISA에 같은 과세 대상 자산, 같은 납입액, 같은 세전 수익률을 적용합니다. 국내 상장주식 매매차익처럼 일반계좌에서도 비과세일 수 있는 수익은 15.4% 과세 대상으로 간주하지 않습니다.

## 구현 내용

### 테스트 환경

Vitest를 개발 의존성으로 추가하고 다음 npm 스크립트를 등록했습니다.

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

도메인 함수만 테스트하므로 이 단계에서는 DOM 테스트 라이브러리를 추가하지 않았습니다.

### 도메인 타입

`src/domain/types.ts`에 다음 타입을 정의했습니다.

- `RiskProfile`: `stable | balanced | aggressive`
- `IsaType`: `general | lowIncome | unknown`
- `SimulationAssumptions`: 금융 계산에 필요한 외부 가정
- `AllocationInput`, `AllocationResult`: 월급 배분 입출력
- `TaxComparisonInput`, `TaxComparisonResult`: 세금 비교 입출력
- `MonthlyProjection`: 36개월 차트용 월별 값
- `WarningCode`: 사용자가 확인해야 하는 계산 상태

### 금융 가정

`src/domain/assumptions.ts`에 변동 가능한 값을 모았습니다.

| 항목 | 기본값 | 성격 |
| --- | ---: | --- |
| 비상금 목표 | 필수지출 3개월분 | 서비스 정책 |
| 시뮬레이션 기간 | 36개월 | 서비스 정책 |
| 안정형 수익률 | 연 2% | 교육용 가정 |
| 중립형 수익률 | 연 5% | 교육용 가정 |
| 적극형 수익률 | 연 8% | 교육용 가정 |
| CMA 수익률 | 연 2.5% | 교육용 가정 |
| 일반계좌 비교 세율 | 15.4% | 동일 과세 대상 수익 가정 |
| ISA 분리과세율 | 9.9% | 지방소득세 포함 |
| 일반형 비과세 한도 | 2,000,000원 | 법적 기준 |
| 서민형 비과세 한도 | 4,000,000원 | 법적 기준 |
| ISA 기본 연간 납입한도 | 20,000,000원 | 법적 기준 |

교육용 수익률은 특정 금융상품의 예상 또는 보장 수익률이 아닙니다. 법적 기준에는 확인일과 외부 출처 URL을 함께 저장했습니다.

### 입력 검증

금액 입력은 0 이상의 안전한 정수만 허용합니다.

- 음수 금액 거부
- 소수 금액 거부
- `NaN`, `Infinity` 거부
- 비상금 목표 계산이 JavaScript 안전 정수 범위를 넘는 경우 거부
- 연 수익률은 -100%보다 큰 유한한 값만 허용

필수지출이 실수령액보다 큰 값은 사용자에게 실제로 발생할 수 있으므로 입력 오류로 거부하지 않습니다. 대신 배정액을 0원으로 제한하고 경고를 반환합니다.

### 월급 배분 함수

`calculateAllocation`은 다음 결과를 반환합니다.

- 월 가용액
- 비상금 목표와 부족액
- CMA와 ISA 월 배정액
- 예상 연간 ISA 배정액
- 경고 코드

경고 코드는 문구와 분리했습니다.

| 코드 | 의미 |
| --- | --- |
| `EXPENSE_EXCEEDS_INCOME` | 필수지출이 실수령액을 초과함 |
| `NO_DISPOSABLE_INCOME` | 배정 가능한 월 가용액이 없음 |
| `ISA_ANNUAL_LIMIT_EXCEEDED` | 예상 ISA 연간 배정액이 기본 한도를 초과함 |
| `ISA_TYPE_DEFAULTED` | ISA 유형 미선택으로 일반형을 적용함 |

이 구조를 사용하면 계산 로직을 바꾸지 않고 화면에서 경고 문구와 표현 방식을 변경할 수 있습니다.

### 36개월 적립식 시뮬레이션

`calculateTaxComparison`은 선택한 투자 성향의 연 수익률을 유효 월 수익률로 변환합니다.

```text
월 수익률 = (1 + 연 수익률)^(1/12) - 1
```

매월 말 납입을 가정해 다음 순서로 36개월을 계산합니다.

```text
이번 달 평가액 = 이전 달 평가액 × (1 + 월 수익률) + 월 납입액
```

월별 원금과 평가액을 `monthlySeries`로 반환하므로 다음 단계의 선·막대 차트에서 재계산 없이 사용할 수 있습니다.

### 세금 비교

```text
과세 대상 수익 = max(예상 평가액 - 원금, 0)
일반계좌 세금 = 과세 대상 수익 × 15.4%

ISA 과세 대상 수익 =
  max(과세 대상 수익 - 유형별 비과세 한도, 0)

ISA 세금 = ISA 과세 대상 수익 × 9.9%
예상 절세액 = max(일반계좌 세금 - ISA 세금, 0)
```

세금 경계값을 직접 검증할 수 있도록 `calculateTaxAmounts`를 별도 순수 함수로 분리했습니다.

## 테스트 내용

총 25개 테스트를 작성했습니다.

### 월급 배분

- 일반적인 비상금 부족 상태
- 비상금 목표 달성 상태
- 비상금 목표 초과 상태
- 필수지출과 실수령액이 같은 상태
- 필수지출이 실수령액을 초과한 상태
- CMA 필요액이 월 가용액보다 큰 상태
- 비상금 부족액의 원 단위 올림
- ISA 예상 연간 배정액 한도 초과
- 외부에서 주입된 납입한도 사용
- 음수·`NaN` 입력 거부

### 시뮬레이션과 세금

- 월 납입액 0원
- 수익률 0%
- 손실 수익률
- ISA 유형 미선택
- 36개월 월별 시계열
- 같은 입력의 결과 재현성
- 음수·소수 월 납입액 거부
- 일반형 비과세 한도 직전·한도·직후
- 서민형 비과세 한도 직전·한도·직후
- 일반계좌와 ISA의 동일 수익 세금 비교

## 검증 결과

다음 명령을 실행했습니다.

```bash
npm test
npm run lint
npm run build
```

결과:

```text
Test Files  2 passed
Tests       25 passed
ESLint      passed
Build       passed
```

## 변경된 파일

```text
package.json
package-lock.json
README.md
docs/01-calculation-core.md
src/domain/assumptions.ts
src/domain/calculateAllocation.ts
src/domain/calculateAllocation.test.ts
src/domain/calculateTaxComparison.ts
src/domain/calculateTaxComparison.test.ts
src/domain/index.ts
src/domain/types.ts
src/domain/validation.ts
```

`src/App.tsx`와 화면 스타일은 이번 작업에서 변경하지 않았습니다.

## 참고 출처

2026년 9월 23일 확인 기준입니다.

- [국가법령정보센터 - ISA 비과세 한도](https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1031850453)
- [기획재정부 - ISA 연간 납입한도와 이월](https://whatsnew.moef.go.kr/mec/ots/dif/view.do?comBaseCd=DIFGODEPRT&difGovDepart1=DIFGODR001&difSer=c514effc-c831-4eb1-94c7-6eab084dcac8&temp=2021&temp2=HALF001)
- [KB증권 - ISA 비과세 한도와 분리과세율](https://www.kbsec.com/go.able?linkcd=m05080009)

## 이번 단계에서 하지 않은 작업

- 입력 폼과 결과 화면
- 차트와 반응형 디자인
- 브라우저 저장
- 백엔드 API와 데이터베이스
- 실제 상품 금리 조회
- 실제 ISA 잔여 한도 계산
- 배포
- Git 초기화, 커밋, 브랜치 작업

## 다음 작업

다음 단계에서는 도메인 함수에 React 입력 폼을 연결합니다. 계산 함수를 UI에서 다시 구현하지 않고 `src/domain`의 공개 API를 호출해야 합니다.

권장 순서:

1. 월급·지출·비상금·투자 성향·ISA 유형 입력 폼
2. 입력 검증과 접근 가능한 오류 문구
3. CMA·ISA 결과 카드
4. 계산 근거와 경고 문구
5. 36개월 시계열과 세금 비교 차트
