import { createRoot } from 'react-dom/client'
import gql from 'graphql-tag'

import { faker } from '@faker-js/faker'

import makeBocchi from './index'
import { ApolloProvider, useQuery } from '@apollo/client'
import { useEffect, useState } from 'react'

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
    description: String!
  }

  type Query {
    packages: [Package!]!
    package: Package
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

const { client } = makeBocchi({
  typeDefs,
  resolvers: {
    Query: {
      package: () => undefined,
      packages: async (...args) => {
        console.log('args', args)
        const abortSignal = args[2].init.signal
        console.log('isAborted', abortSignal)
        if (abortSignal.aborted) {
          console.error(abortSignal.reason.stack)
        }
        abortSignal.addEventListener('abort', (...args) => {
          console.log('aborted', ...args)
        })
        await new Promise(resolve => setTimeout(resolve, 1000))
        return (
          Array(10)
            .fill(0)
            .map(makeFakePackage)
        )
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

  query {
    packages {
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

const Foo = () => {
  const { data, error } = useQuery(GET_PACKAGES)
  const packages = data?.packages
  if (error) console.error(error)
  console.log('packages', packages)
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

  useEffect(() => {
    setTimeout(() => {
      setFoo(false)
    }, 500)
  }, [])

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
