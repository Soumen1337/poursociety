# PourSociety city price sources

The following official/state sources were checked on **15 November 2026** and registered in `public.price_sources`. The 148 seeded city-price values remain **unverified legacy estimates** until each one is checked against a current official SKU/pack-size record or an authorized retailer feed.

| City | Official source | Scope observed | Automation status |
|---|---|---|---|
| Delhi | [Delhi Excise Department — Price List](https://excise.delhi.gov.in/excise/additional-information-0) | Official department page links to a separate Price List portal | Manual review required; machine-readable API/access terms not verified |
| Gurgaon | [Haryana Excise Policy 2025–27](https://haryanatax.gov.in/HEX/DownloadPDF?formName=%2FExcisePolicy2025_27%2FExcise_Policy_2025_27.pdf) | Minimum retail-price bands and pack-size categories for 1 April 2026–31 March 2027; not a complete SKU-level list | Manual review required; policy bands must not be treated as exact brand MRP |
| Noida | [Uttar Pradesh Excise IESCMS](https://cms.upexciseonline.co/) | Official portal exposes Entity Type Wise MRP and Liquor Type Wise MRP | Manual review required; automated endpoint/access terms not verified |
| Jaipur | [Rajasthan Excise — Approved Rate List 2026–27](https://excise.rajasthan.gov.in/RSED/Website/Approved-Rate-List.aspx) and [Search Brand MRP](https://excise.rajasthan.gov.in/RSBCL-Price-List-BrandWise.aspx) | Official brand/approved-rate portal | Manual review required; dynamic result request/API contract not verified |

## Why automatic prices are not enabled yet

A public portal is not automatically an API or permission to scrape. Safe automation needs a stable authorized endpoint, clear product/variant/pack-size matching, access terms that permit automated retrieval, and a validation step. Haryana's policy publishes category price floors; it must not be conflated with live SKU-level MRP.

The authenticated `price-ingest` Edge Function is deployed and accepts validated price rows from an approved source. It records source name, URL, update time and price history. New ingested prices remain unverified until an administrator checks the underlying source. No scheduled importer is active because no supported/authorized machine-readable price feed has yet been confirmed.

Official-source checks:
- Delhi's official page lists a separate “Price List” link.
- Haryana's policy gives category/pack-size minimum retail prices for FY 2026–27.
- UP Excise's official portal lists Entity Type Wise MRP and Liquor Type Wise MRP.
- Rajasthan's official rate-list portal identifies the 2026–27 year and a Search Brand MRP facility.
