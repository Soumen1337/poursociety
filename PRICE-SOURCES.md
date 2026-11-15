# PourSociety city price sources

The following official state sources were checked on **15 November 2026** and registered in `public.price_sources`. The original catalogue contains **43 products and 148 city-price estimates**. Those values are unverified legacy snapshots with unknown source dates, not live retail quotes.

| City | Official source | What it publishes | Automation status |
|---|---|---|---|
| Delhi | [Delhi Excise Department — Additional Information / Price List](https://excise.delhi.gov.in/excise/additional-information-0) | The official page links to a separate Price List portal at `delhiexcise.gov.in/Portal/priceList.action`. The target portal timed out during this check. | Manual review required; no supported API or automated-access terms verified |
| Gurgaon | [Haryana Excise Policy 2025–27](https://haryanatax.gov.in/HEX/DownloadPDF?formName=%2FExcisePolicy2025_27%2FExcise_Policy_2025_27.pdf) | Minimum retail-sale price schedules by category and pack size, including a 01-Apr-2026 to 31-Mar-2027 schedule. It is not a complete SKU-level MRP feed. | Manual review required; policy floors must not be substituted for exact brand/pack MRP |
| Noida | [UP Excise — Entity Type Wise MRP](https://cms.upexciseonline.co/brand-mrp/) | Dynamic table with Financial Year, Entity Type and Domain filters; result columns include unit, brand, sale domain, size, package type and MRP. Rows are dynamically loaded. | Manual review required; no public API contract or automated-access terms verified |
| Jaipur | [Rajasthan Excise — Approved Rate List 2026–27](https://excise.rajasthan.gov.in/RSED/Website/Approved-Rate-List.aspx) and [Search Brand MRP](https://excise.rajasthan.gov.in/RSBCL-Price-List-BrandWise.aspx) | Approved-rate categories include IMFL, Beer, Imported, CL and RML; a separate brand-MRP page is available. The department page says last updated 07-Aug-2026. | Manual review required; no public API contract or automated-access terms verified |

## Why automatic price overwrites are disabled

A public page is not automatically a supported data API. Reliable automation needs a stable official or authorized endpoint, permission for automated retrieval, exact brand-variant/pack-size matching, and a validation path. Haryana publishes minimum prices by category and pack size, not exact retail MRP for every SKU. UP and Rajasthan expose dynamic tables, but their data endpoints and automated-access terms have not been verified. Delhi links to a separate price portal that was not retrievable during this check.

The deployed `price-ingest` Edge Function accepts validated rows from an approved feed and logs source details and price history. API imports remain unverified until an administrator checks them. **No scheduled live price importer is enabled.** Do not silently overwrite prices until an authorized source integration and brand/pack-size matching have been tested.
