package com.yourco.agro;

import com.yourco.agro.persistence.JpaSql;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.tool.schema.internal.script.MultiLineSqlScriptExtractor;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.annotation.EnableTransactionManagement;

import java.io.IOException;
import java.io.StringReader;
import java.util.Map;
import java.util.UUID;

import static java.nio.charset.StandardCharsets.UTF_8;

@TestConfiguration(proxyBeanMethods = false)
@EnableTransactionManagement
@Import(JpaSql.class)
class JpaTestConfig {
  static LocalContainerEntityManagerFactoryBean database(String... scripts) throws IOException {
    StringBuilder schema = new StringBuilder();
    for (String script : scripts) {
      schema.append(new ClassPathResource(script).getContentAsString(UTF_8)).append('\n');
    }

    var factory = new LocalContainerEntityManagerFactoryBean();
    factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
    factory.setPackagesToScan("com.yourco.agro");
    factory.setJpaPropertyMap(Map.of(
      "jakarta.persistence.jdbc.url", "jdbc:h2:mem:" + UUID.randomUUID(),
      "jakarta.persistence.jdbc.user", "sa",
      "jakarta.persistence.schema-generation.database.action", "create",
      "jakarta.persistence.schema-generation.create-source", "script",
      "jakarta.persistence.schema-generation.create-script-source", new StringReader(schema.toString()),
      "hibernate.hbm2ddl.import_files_sql_extractor", MultiLineSqlScriptExtractor.class.getName(),
      "hibernate.hbm2ddl.halt_on_error", true
    ));
    return factory;
  }

  @Bean
  JpaTransactionManager transactionManager(EntityManagerFactory factory) {
    return new JpaTransactionManager(factory);
  }
}
