import { createRoot } from 'react-dom/client'
import gql from 'graphql-tag'

import { faker } from '@faker-js/faker'

import makeBocchi, { useQuery } from './index'
import { ApolloProvider } from '@apollo/client'
import { useState } from 'react'

const typeDefs = gql(`#gql
  interface Handle {
    scheme: String!
    id: String!
    uri: String!
    handles: [Handle!]!
  }

  type Package implements Handle {
    scheme: String!
    id: String!
    uri: String!
    handles: [Package!]!
    name: String!
    description: String
  }

  type Query {
    packages(scheme: String, search: String!): [Package!]!
    package(scheme: String, id: String, uri: String): Package
  }
`)

const makeFakePackage = () => {
  const name = faker.internet.domainName()
  const scheme = name.split('-').map((s) => s[0]).join('')
  const id = faker.random.numeric(5)
  const description = faker.company.catchPhrase()
  return ({
    scheme,
    id,
    uri: `${scheme}:${id}`,
    name,
    description,
    handles: []
  })
}

const firstPackages =
  Array(10)
    .fill(0)
    .map(makeFakePackage)

type NPMResponse = {
  objects: {
    package: {
      name: string
      version: string
      description: string
      keywords: string[]
      date: string
      links: {
        npm: string
        homepage: string
        repository: string
        bugs: string
      }
      publisher: {
        username: string
        email: string
      }
      maintainers: {
        username: string
        email: string
      }[]
    }
    score: {
      final: number
      detail: {
        quality: number
        popularity: number
        maintenance: number
      }
    }
    searchScore: number
  }[]
  total: number
  time: string
}

/**
 * Note: the values of quality, popularity, and maintenance are normalized into a unit-vector provide values between 0 - 1 for each to modify weightings, e.g., to return results based solely on quality, set quality=1.0, maintenance=0.0, popularity=0.0.
 */
type NPMPackageSearchMeta = {
  /** how many results should be returned (default 20, max 250) */
  size?: number
  /** offset to return results from */
  from?: number
  /** how much of an effect should quality have on search results */
  quality?: number
  /** how much of an effect should popularity have on search results */
  popularity?: number
  /** how much of an effect should maintenance have on search results */
  maintenance?: number
}

/** Special search qualifiers can be provided in the full-text query: */
type NPMPackageSearch = {
  /** full-text search to apply */
  search: string
  /** Show/filter results in which bcoe is the author */
  author?: string | string[]
  /** Show/filter results in which bcoe is qualifier as a maintainer */
  maintainer?: string | string[]
  /** Show/filter results that have batman in the keywords
   * separating multiple keywords with
   * `,` acts like a logical `OR`
   * `+` acts like a logical `AND`
   * `,-` can be used to exclude keywords
  */
  keywords?: string | string[]
  /** Exclude packages whose version is < 1.0.0 */
  unstable?: boolean
  /** Exclude packages that are insecure or have vulnerable dependencies (based on the nsp registry) */
  insecure?: boolean
  /** Do not boost exact matches, defaults to true */
  boostExact?: boolean
}

const joinArrayToSearch = (arr: string | string[] | undefined) =>
  Array.isArray(arr) ? arr.join(' ') : (arr ?? '')

/** More docs here https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#getpackage */
const makeNpmSearchString = ({
  search, author, maintainer, keywords,
  unstable, insecure, boostExact
}: NPMPackageSearch): string => 
  [
    ...search ? [search]: [],
    ...author ? [joinArrayToSearch(author)]: [],
    ...maintainer ? [joinArrayToSearch(maintainer)]: [],
    ...keywords ? [typeof keywords === 'string' ? keywords : keywords.join(' ')]: [],
    ...unstable !== undefined ? [unstable ? 'is:unstable' : 'not:unstable']: [],
    ...insecure !== undefined ? [insecure ? 'is:insecure' : 'not:insecure']: [],
    ...boostExact !== undefined ? [boostExact ? 'boost-exact:true' : 'boost-exact:false']: []
  ].filter(Boolean)
  .join(' ')

const fetchNpm = ({
  search, size, from, quality, popularity, maintenance,
  author, maintainer, keywords, unstable, insecure, boostExact
}: NPMPackageSearchMeta & NPMPackageSearch): Promise<NPMResponse> =>
  fetch(`https://registry.npmjs.com/-/v1/search?${
    new URLSearchParams({
      text: makeNpmSearchString({ search, author, maintainer, keywords, unstable, insecure, boostExact }),
      ...size !== undefined && { size: size.toString() },
      ...from !== undefined && { from: from.toString() },
      ...quality !== undefined && { quality: quality.toString() },
      ...popularity !== undefined && { popularity: popularity.toString() },
      ...maintenance !== undefined && { maintenance: maintenance.toString() }
    })
  }`).then(res => res.json())
  // fetch('https://registry.npmjs.com/-/v1/search?text=@banou/asar&size=250')

const { client, cache } = makeBocchi({
  typeDefs,
  resolvers: {
    Query: {
      package: () => undefined,
      packages: async (source, args, context, info) => {
        const npmPackages = await fetchNpm({ search: args.search, size: 250 })
        console.log('npmPackages', npmPackages)
        return npmPackages.objects.map(pkg => ({
          scheme: 'npm',
          id: pkg.package.name,
          uri: `npm:${pkg.package.name}`,
          name: pkg.package.name,
          description: pkg.package.description,
          handles: []
        }))
      }
    }
  }
})

const GET_PACKAGES = gql(`#gql
  fragment Handle on Handle {
    scheme
    id
    uri
    handles {
      scheme
      id
      uri
    }
  }

  query GetPackages($scheme: String, $search: String!) {
    packages(scheme: $scheme, search: $search) {
      scheme
      id
      uri
      handles {
        ...Handle
      }
      name
      description
    }
  }
`)

cache.writeQuery({
  query: GET_PACKAGES,
  data: {
    packages: firstPackages
  }
})

const Foo = () => {
  const { data, error, loading } = useQuery(GET_PACKAGES, { variables: { scheme: 'npm', search: 'asar' } })
  const packages = data?.packages
  if (error) console.error(error)
  console.log('packages', loading, packages)
  return (
    <div>
      foo
      {
        packages?.map(pkg => (
          <div key={pkg.id}>
            {JSON.stringify(pkg)}
          </div>
        ))
      }
    </div>
  )
}

const Mount = () => {
  const [foo, setFoo] = useState(true)

  // console.log('foo', foo)
  // useEffect(() => {
  //   setTimeout(() => {
  //     setFoo(false)
  //   }, 1500)
  // }, [])

  return (
    <div>
      {
        foo && (
          <Foo/>
        )
      }
    </div>
  )
}

const mountElement = document.createElement('div')

const root = createRoot(
  document.body.appendChild(mountElement)
)

root.render(
  <>
    <ApolloProvider client={client}>
      <Mount/>
    </ApolloProvider>
  </>
)

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    root.unmount()
    mountElement.remove()
  })
}
