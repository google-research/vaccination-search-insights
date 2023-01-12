SRC_DIR = public/data

$(SRC_DIR):
	mkdir -p $@

US_vaccination_search_insights.csv: $(SRC_DIR)
	curl -o $(SRC_DIR)/US_vaccination_search_insights.csv https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/US_vaccination_search_insights.csv

GB_vaccination_search_insights.csv: $(SRC_DIR)
	curl -o $(SRC_DIR)/GB_vaccination_search_insights.csv https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/GB_vaccination_search_insights.csv

# modifying the contents of CA_vaccination_search_insights.csv to move the FSAs up to county level so simplify data visualization processing and leaving the original data for download unchanged.
CA_vaccination_search_insights.csv: $(SRC_DIR)
	curl -o $(SRC_DIR)/CA_temp.csv https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/CA_vaccination_search_insights.csv
	cat $(SRC_DIR)/CA_temp.csv | awk 'NR==1' > $(SRC_DIR)/$@
	cat $(SRC_DIR)/CA_temp.csv | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' 'NR>1 { print $$1,$$2,$$3,$$4,$$5,$$9,$$9,"","",$$10,$$11,$$12,$$13 }' >> $(SRC_DIR)/$@
	rm -f $(SRC_DIR)/CA_temp.csv

IE_vaccination_search_insights.csv: $(SRC_DIR)
	curl -o $(SRC_DIR)/IE_vaccination_search_insights.csv https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/IE_vaccination_search_insights.csv

AU_vaccination_search_insights.csv: $(SRC_DIR)
	curl -o $(SRC_DIR)/AU_vaccination_search_insights.csv https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/AU_vaccination_search_insights.csv

Global_l0_vaccination_search_insights.csv: US_vaccination_search_insights.csv GB_vaccination_search_insights.csv CA_vaccination_search_insights.csv IE_vaccination_search_insights.csv AU_vaccination_search_insights.csv
	cat $(SRC_DIR)/$(word 1,$^) | awk 'NR==1' > $(SRC_DIR)/$@
	cat $(SRC_DIR)/$(word 1,$^) | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' 'length($$4) < 1' >> $(SRC_DIR)/$@
	cat $(SRC_DIR)/$(word 2,$^) | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' 'length($$4) < 1' >> $(SRC_DIR)/$@
	cat $(SRC_DIR)/$(word 3,$^) | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' 'length($$4) < 1' >> $(SRC_DIR)/$@
	cat $(SRC_DIR)/$(word 4,$^) | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' 'length($$4) < 1' >> $(SRC_DIR)/$@
	cat $(SRC_DIR)/$(word 5,$^) | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' 'length($$4) < 1' >> $(SRC_DIR)/$@

gb_regions.csv: $(SRC_DIR)/gb_regions.csv
au_regions.csv: $(SRC_DIR)/au_regions.csv

regions.csv: US_vaccination_search_insights.csv gb_regions.csv au_regions.csv CA_vaccination_search_insights.csv IE_vaccination_search_insights.csv
	cat $(SRC_DIR)/$(word 1,$^) | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' '{ print $$2,$$3,$$4,$$5,$$6,$$7,$$8,$$9,$$10 }' | uniq > $(SRC_DIR)/$@
	cat $(SRC_DIR)/$(word 2,$^) | awk 'NR>1' >> $(SRC_DIR)/$@
	cat $(SRC_DIR)/$(word 3,$^) | awk 'NR>1' >> $(SRC_DIR)/$@
	cat $(SRC_DIR)/$(word 4,$^) | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' 'NR>1 { print $$2,$$3,$$4,$$5,$$6,$$7,$$8,$$9,$$10 }' | uniq >> $(SRC_DIR)/$@
	cat $(SRC_DIR)/$(word 5,$^) | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' 'NR>1 { print $$2,$$3,$$4,$$5,$$6,$$7,$$8,$$9,$$10 }' | uniq >> $(SRC_DIR)/$@

US_initial.csv: US_vaccination_search_insights.csv
	cat $(SRC_DIR)/$(word 1,$^) | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' '($$8) != "postal_code"' > $(SRC_DIR)/$@

US_zips_2021.csv: US_vaccination_search_insights.csv
	cat $(SRC_DIR)/$(word 1,$^) | awk 'NR==1' > $(SRC_DIR)/$@
	cat $(SRC_DIR)/$(word 1,$^) | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' '($$8) == "postal_code" && index($$1, "2021")' >> $(SRC_DIR)/$@

US_zips_2022.csv: US_vaccination_search_insights.csv
	cat $(SRC_DIR)/$(word 1,$^) | awk 'NR==1' > $(SRC_DIR)/$@
	cat $(SRC_DIR)/$(word 1,$^) | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' '($$8) == "postal_code" && index($$1, "2022")' >> $(SRC_DIR)/$@

US_zips_2023.csv: US_vaccination_search_insights.csv
	cat $(SRC_DIR)/$(word 1,$^) | awk 'NR==1' > $(SRC_DIR)/$@
	cat $(SRC_DIR)/$(word 1,$^) | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' '($$8) == "postal_code" && index($$1, "2023")' >> $(SRC_DIR)/$@
	rm -f $(SRC_DIR)/$(word 1,$^)

All_dates.csv: Global_l0_vaccination_search_insights.csv
	cat $(SRC_DIR)/$(word 1,$^) | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' 'NR>1 { print $$1 }' | sort -u | uniq >> $(SRC_DIR)/$@

data: Global_l0_vaccination_search_insights.csv AU_vaccination_search_insights.csv GB_vaccination_search_insights.csv regions.csv IE_vaccination_search_insights.csv CA_vaccination_search_insights.csv US_initial.csv US_zips_2021.csv US_zips_2022.csv US_zips_2023.csv All_dates.csv
