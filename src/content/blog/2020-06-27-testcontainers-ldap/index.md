---
title: "Testing LDAP clients with Docker"
description: "Integration testing with testcontainers-go"
date: "Jun 27 2020"
tags: golang testing docker
---

LDAP is complex: it is an extensible standard with decades of history and dozens of vendors. This makes handling all possible use cases and configurations 
cumbersome (just look at [Jenkins](https://plugins.jenkins.io/ldap/) and 
[Jira](https://confluence.atlassian.com/adminjiraserver/connecting-to-an-ldap-directory-938847052.html) for example) and makes integration testing crucial. 
The most common approach I have seen (and which seems to be used by the [go-ldap](https://github.com/go-ldap/ldap/blob/45321a6717b4042e9f52290e409ff04aaed13c29/ldap_test.go#L8-L10) folks) 
is to test LDAP integration code against [public LDAP servers](https://ldapwiki.com/wiki/Public%20LDAP%20Servers). Although this has some advantages, namely reduced test runtime and 
reduced test code complexity, sending requests to the public internet is not always an option and definitely makes the tests more brittle.

In this post I'll demonstrate the use of Docker to facilitate LDAP integration testing in Golang. The full code can be found [on my GitHub](https://github.com/scottysseus/ldap-testing-example).

### Approach

Some folks created an easy-to-use [Docker image for OpenLDAP](https://github.com/osixia/docker-openldap) that we'll use to facilitate the integration testing. 
Aided by [testcontainers-go](https://github.com/testcontainers/testcontainers-go), we can easily create fixtures against which we can test basic LDAP integration and 
more complex things like:

- TLS configuration
- Support for referrals and aliases
- Authenticated connections

I'll provide only a basic example with a single container testing a basic search using go-ldap, but this example can be extended to table-based tests for a plethora of configurations.

### The Code

Let's first look at the [`TestMain` function](https://github.com/scottysseus/ldap-testing-example/blob/master/ldap_test.go#L50):

```golang
var port nat.Port

func TestMain(m *testing.M) {
	ctx := context.Background()
	testDataPath, err := filepath.Abs("./testdata")
	ldapC, err := startLDAPContainer(ctx, ldapContainerRequest{
		ldif:    filepath.Join(testDataPath, "test.ldif"),
		baseDN:  "dc=test,dc=com",
		orgName: "Test",
		domain:  "test.com",
	})
	if err != nil {
		panic(err)
	}
	defer ldapC.Terminate(ctx)

	ldapPort, _ := nat.NewPort("tcp", "389")

	port, err = ldapC.MappedPort(ctx, ldapPort)
	if err != nil {
		panic(err)
	}

	os.Exit(m.Run())
}
```

This code calls a function, `startLDAPContainer`, and provides it with an `ldapContainerRequest` object. In the request object it provides parameters for the 
container: the path to an LDIF file for our test data and information on the domain and organization.

Crucially, we defer the removal of the containers until the tests complete. In this example I am starting the container at the package level, but this can 
be adapted to instead start containers on a per-test basis as well.

The container's port is saved in a package variable for use in the test itself.

`startLDAPContainer` is where testcontainers-go comes into play:

```golang
const imageName = "osixia/openldap:1.3.0"

type ldapContainerRequest struct {
	ldif string
	baseDN, orgName, domain string
	tls bool
}

func startLDAPContainer(ctx context.Context, ldapReq ldapContainerRequest) (testcontainers.Container, error) {
	req := testcontainers.ContainerRequest{
		Image: imageName,
		Env: map[string]string{
			"LDAP_ORGANISATION": ldapReq.orgName,
			"LDAP_DOMAIN":       ldapReq.domain,
			"LDAP_BASE_DN":      ldapReq.baseDN,
			"LDAP_TLS":          strconv.FormatBool(ldapReq.tls),
		},
		ExposedPorts: []string{"389/tcp"},
		Cmd:          []string{"--copy-service"},
		BindMounts: map[string]string{
			ldapReq.ldif: "/container/service/slapd/assets/config/bootstrap/ldif/custom/node.ldif",
		},
		WaitingFor: wait.ForLog("slapd starting"),
	}

	return testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
}
```

This code sets up the osixia/openldap container. I recommend going over their documentation for more information, but I would like to highlight here the bit 
where `--copy-service` is added to the container `CMD`. It is necessary because the container's startup scripts make modifications to the LDIF files during 
startup; when using a bind mount, this can cause the startup to fail. The flag directs the startup scripts to copy the LDIF files and make modifications on 
the copies instead.

Finally, the test itself:

```golang
// TestSearch attempts a basic search against the LDAP Docker container.
// The search requires a bind using the default admin credentials.
func TestSearch(t *testing.T) {
	assert := assert.New(t)

	// create an LDAP connection
	conn, err := ldap.DialURL(fmt.Sprintf("ldap://localhost:%s", port.Port()))
	if !assert.NoError(err) {
		t.FailNow()
	}

	// by default, osixia/openldap creates an admin user with the supplied base DN and a password of 'admin'
	_, err = conn.SimpleBind(ldap.NewSimpleBindRequest("cn=admin,dc=test,dc=com", "admin", nil))
	if !assert.NoError(err) {
		t.FailNow()
	}

	res, err := conn.Search(ldap.NewSearchRequest("ou=users,dc=test,dc=com",
		ldap.ScopeWholeSubtree,
		ldap.DerefAlways, // alias dereference policy
		1, // result size limit
		0, // search time limit - no limit
		false, // return attribute types only
		"(objectClass=inetOrgPerson)",
		[]string{"dn"}, // attributes to return
		nil)) // additional search controls

	if !assert.NoError(err) {
		t.FailNow()
	}

	assert.NotEmpty(res.Entries)
	assert.Equal("uid=user1,ou=users,dc=test,dc=com", res.Entries[0].DN)
}
```

This test just performs a basic search request and verifies the result. Before performing the search, the test first authenticates using the default
admin credentials provided by the container.

Lastly, look at the LDIF:

```
dn: ou=users,dc=test,dc=com
objectClass: organizationalUnit
ou: users

dn: uid=user1,ou=users,dc=test,dc=com
objectClass: inetOrgPerson
cn: User
sn: One
displayName: User One
uid: user1
```

For the sake of this example it is simple with just one user and one organizational unit. Note that the container will automatically create the entries 
for the domain provided with the initial configuration.

### Assessment

A link to the full working code is at the start of this article; try running it for yourself. For me, the test code takes only about a second or 2 
to run, including the setup and teardown of the container and the test itself. This seems pretty cheap considering the flexibility afforded here 
and the possibility this opens up for table-driven testing against potentially dozens of different configurations, including forests of LDAP servers.
